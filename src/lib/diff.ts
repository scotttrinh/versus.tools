import { diffLines, diffWordsWithSpace } from "diff";

export interface DiffLine {
  html: string;
  type: "same" | "add" | "remove" | "spacer";
}

export interface DiffResult {
  unified: DiffLine[];
  left: DiffLine[];
  right: DiffLine[];
}

export const DIFF_COLORS = {
  remove: { bg: "rgba(248, 81, 73, 0.10)", gutter: "rgba(248, 81, 73, 0.20)", inline: "rgba(248, 81, 73, 0.30)" },
  add: { bg: "rgba(63, 185, 80, 0.10)", gutter: "rgba(63, 185, 80, 0.20)", inline: "rgba(63, 185, 80, 0.30)" },
  spacer: { bg: "rgba(255, 255, 255, 0.03)" },
};

/** Compute plain-text character ranges that differ at the word level. */
export function computeInlineRanges(
  oldText: string,
  newText: string,
  side: "remove" | "add",
): Array<[number, number]> {
  const changes = diffWordsWithSpace(oldText, newText);
  const ranges: Array<[number, number]> = [];
  let pos = 0;

  for (const change of changes) {
    if (side === "remove") {
      if (change.added) continue;
      if (change.removed) {
        ranges.push([pos, pos + change.value.length]);
      }
      pos += change.value.length;
    } else {
      if (change.removed) continue;
      if (change.added) {
        ranges.push([pos, pos + change.value.length]);
      }
      pos += change.value.length;
    }
  }

  // Merge ranges that are adjacent or separated by only whitespace
  const text = side === "remove" ? oldText : newText;
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last) {
      const gap = text.slice(last[1], r[0]);
      if (gap.length === 0 || /^\s+$/.test(gap)) {
        last[1] = Math.max(last[1], r[1]);
        continue;
      }
    }
    merged.push([...r]);
  }

  return merged;
}

/** Insert highlight <span>s into Shiki HTML at the given plain-text ranges. */
export function insertHighlightSpans(
  html: string,
  ranges: Array<[number, number]>,
  color: string,
): string {
  if (ranges.length === 0) return html;

  let result = "";
  let textPos = 0;
  let ri = 0;
  let inHL = false;

  const openTag = `<span style="background:${color}">`;

  function checkBoundaries() {
    // Close highlight if we've reached the end of the current range
    while (inHL && ri < ranges.length && textPos >= ranges[ri][1]) {
      result += "</span>";
      inHL = false;
      ri++;
    }
    // Open highlight if we've reached the start of the next range
    if (!inHL && ri < ranges.length && textPos >= ranges[ri][0] && textPos < ranges[ri][1]) {
      result += openTag;
      inHL = true;
    }
  }

  for (let i = 0; i < html.length; ) {
    if (html[i] === "<") {
      // Check if highlight should end before crossing tag boundary
      while (inHL && ri < ranges.length && textPos >= ranges[ri][1]) {
        result += "</span>";
        inHL = false;
        ri++;
      }
      // Close highlight across tag boundary, then reopen (to maintain valid HTML nesting)
      const wasInHL = inHL;
      if (inHL) { result += "</span>"; inHL = false; }
      const tagEnd = html.indexOf(">", i);
      result += html.slice(i, tagEnd + 1);
      i = tagEnd + 1;
      if (wasInHL) { result += openTag; inHL = true; }
      continue;
    }

    checkBoundaries();

    if (html[i] === "&") {
      const semiIdx = html.indexOf(";", i);
      if (semiIdx !== -1) {
        result += html.slice(i, semiIdx + 1);
        textPos++;
        i = semiIdx + 1;
        continue;
      }
    }

    result += html[i];
    textPos++;
    i++;
  }

  if (inHL) result += "</span>";
  return result;
}

export function splitShikiHtmlIntoLines(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lineSpans = doc.querySelectorAll("span.line");
  return Array.from(lineSpans).map((el) => el.innerHTML);
}

export function computeDiff(
  leftCode: string,
  rightCode: string,
  leftHtml: string,
  rightHtml: string,
): DiffResult {
  const leftLines = splitShikiHtmlIntoLines(leftHtml);
  const rightLines = splitShikiHtmlIntoLines(rightHtml);
  const leftPlainLines = leftCode.split("\n");
  const rightPlainLines = rightCode.split("\n");
  const changes = diffLines(leftCode, rightCode);

  const unified: DiffLine[] = [];
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];

  let leftIdx = 0;
  let rightIdx = 0;

  function countLines(value: string) {
    return value.replace(/\n$/, "").split("\n").length;
  }

  /** Apply word-level highlights to a paired line. */
  function highlightLine(
    shikiHtml: string,
    oldPlain: string,
    newPlain: string,
    side: "remove" | "add",
  ): string {
    const ranges = computeInlineRanges(oldPlain, newPlain, side);
    const color = side === "remove" ? DIFF_COLORS.remove.inline : DIFF_COLORS.add.inline;
    return insertHighlightSpans(shikiHtml, ranges, color);
  }

  for (let ci = 0; ci < changes.length; ci++) {
    const change = changes[ci];
    const lineCount = countLines(change.value);

    if (change.removed) {
      // Look ahead: if the next change is an addition, pair them as modifications
      const next = changes[ci + 1];
      if (next && next.added) {
        const addCount = countLines(next.value);
        const maxCount = Math.max(lineCount, addCount);
        const pairedCount = Math.min(lineCount, addCount);

        // Unified: show all removals then all additions, with inline highlights on paired lines
        for (let i = 0; i < lineCount; i++) {
          const rawHtml = leftLines[leftIdx + i] || "";
          const html = i < pairedCount
            ? highlightLine(rawHtml, leftPlainLines[leftIdx + i] || "", rightPlainLines[rightIdx + i] || "", "remove")
            : rawHtml;
          unified.push({ html, type: "remove" });
        }
        for (let i = 0; i < addCount; i++) {
          const rawHtml = rightLines[rightIdx + i] || "";
          const html = i < pairedCount
            ? highlightLine(rawHtml, leftPlainLines[leftIdx + i] || "", rightPlainLines[rightIdx + i] || "", "add")
            : rawHtml;
          unified.push({ html, type: "add" });
        }

        // Side-by-side: pair lines together, with inline highlights, spacers for the shorter side
        for (let i = 0; i < maxCount; i++) {
          if (i < lineCount) {
            const rawHtml = leftLines[leftIdx + i] || "";
            const html = i < pairedCount
              ? highlightLine(rawHtml, leftPlainLines[leftIdx + i] || "", rightPlainLines[rightIdx + i] || "", "remove")
              : rawHtml;
            left.push({ html, type: "remove" });
          } else {
            left.push({ html: "", type: "spacer" });
          }
          if (i < addCount) {
            const rawHtml = rightLines[rightIdx + i] || "";
            const html = i < pairedCount
              ? highlightLine(rawHtml, leftPlainLines[leftIdx + i] || "", rightPlainLines[rightIdx + i] || "", "add")
              : rawHtml;
            right.push({ html, type: "add" });
          } else {
            right.push({ html: "", type: "spacer" });
          }
        }

        leftIdx += lineCount;
        rightIdx += addCount;
        ci++; // skip the next (added) change since we consumed it
      } else {
        // Pure removal with no paired addition
        for (let i = 0; i < lineCount; i++) {
          const line: DiffLine = { html: leftLines[leftIdx + i] || "", type: "remove" };
          unified.push(line);
          left.push(line);
          right.push({ html: "", type: "spacer" });
        }
        leftIdx += lineCount;
      }
    } else if (change.added) {
      // Pure addition (not preceded by a removal — that case is handled above)
      for (let i = 0; i < lineCount; i++) {
        const line: DiffLine = { html: rightLines[rightIdx + i] || "", type: "add" };
        unified.push(line);
        left.push({ html: "", type: "spacer" });
        right.push(line);
      }
      rightIdx += lineCount;
    } else {
      // Unchanged lines
      for (let i = 0; i < lineCount; i++) {
        const sameLine: DiffLine = { html: leftLines[leftIdx + i] || "", type: "same" };
        unified.push(sameLine);
        left.push(sameLine);
        right.push({ html: rightLines[rightIdx + i] || "", type: "same" });
      }
      leftIdx += lineCount;
      rightIdx += lineCount;
    }
  }

  return { unified, left, right };
}
