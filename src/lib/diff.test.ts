import { describe, it, expect } from "vitest";
import { computeInlineRanges, insertHighlightSpans, computeDiff } from "./diff";

describe("computeInlineRanges", () => {
  it("returns empty ranges for identical strings", () => {
    expect(computeInlineRanges("hello world", "hello world", "remove")).toEqual(
      [],
    );
    expect(computeInlineRanges("hello world", "hello world", "add")).toEqual(
      [],
    );
  });

  it("returns correct range on the add side for a single word added", () => {
    const ranges = computeInlineRanges("hello", "hello world", "add");
    // "hello" is the same, " world" is added
    expect(ranges.length).toBe(1);
    expect(ranges[0][0]).toBe(5); // starts after "hello"
    expect(ranges[0][1]).toBe(11); // ends after " world"
  });

  it("returns correct range on the remove side for a single word removed", () => {
    const ranges = computeInlineRanges("hello world", "hello", "remove");
    // "hello" is the same, " world" is removed
    expect(ranges.length).toBe(1);
    expect(ranges[0][0]).toBe(5);
    expect(ranges[0][1]).toBe(11);
  });

  it("merges adjacent changed words separated by whitespace", () => {
    // "foo bar" -> "baz qux" — both words change, separated by a space
    const ranges = computeInlineRanges("foo bar", "baz qux", "remove");
    // "foo" and "bar" are both removed, with a space between — should merge
    expect(ranges.length).toBe(1);
    expect(ranges[0]).toEqual([0, 7]);
  });
});

describe("insertHighlightSpans", () => {
  const color = "rgba(255,0,0,0.3)";

  it("returns HTML unchanged when ranges are empty", () => {
    const html = '<span style="color:#f00">hello</span>';
    expect(insertHighlightSpans(html, [], color)).toBe(html);
  });

  it("wraps plain text in a highlight span for a single range", () => {
    const result = insertHighlightSpans("hello world", [[6, 11]], color);
    expect(result).toBe(
      `hello <span style="background:${color}">world</span>`,
    );
  });

  it("closes and reopens highlight across Shiki span tag boundaries", () => {
    // Simulate Shiki output: <span style="color:#f00">hel</span><span style="color:#0f0">lo</span>
    const html =
      '<span style="color:#f00">hel</span><span style="color:#0f0">lo</span>';
    // Highlight "ello" = positions 1-5
    const result = insertHighlightSpans(html, [[1, 5]], color);
    // The highlight should close before crossing tag boundaries and reopen after
    expect(result).toContain(`<span style="background:${color}">`);
    // Verify it produces valid nesting by checking open/close counts
    const openCount = (result.match(/<span /g) || []).length;
    const closeCount = (result.match(/<\/span>/g) || []).length;
    expect(openCount).toBe(closeCount);
  });

  it("treats HTML entities as single characters", () => {
    // "a<b" encoded as "a&lt;b" — 3 text chars, but 7 HTML chars
    const html = "a&lt;b";
    // Highlight character at index 1 (the "<" / &lt;)
    const result = insertHighlightSpans(html, [[1, 2]], color);
    expect(result).toBe(
      `a<span style="background:${color}">&lt;</span>b`,
    );
  });
});

// computeDiff uses DOMParser internally via splitShikiHtmlIntoLines
// @vitest-environment happy-dom
describe("computeDiff", () => {
  // Helper to build minimal Shiki-like HTML wrapping each line in a span.line
  function fakeShikiHtml(lines: string[]): string {
    const inner = lines.map((l) => `<span class="line">${l}</span>`).join("");
    return `<pre class="shiki"><code>${inner}</code></pre>`;
  }

  it("returns all same lines for identical code", () => {
    const code = "line1\nline2\nline3";
    const html = fakeShikiHtml(["line1", "line2", "line3"]);
    const result = computeDiff(code, code, html, html);

    expect(result.unified.every((l) => l.type === "same")).toBe(true);
    expect(result.unified.length).toBe(3);
    expect(result.left.length).toBe(3);
    expect(result.right.length).toBe(3);
  });

  it("marks all lines as remove/add for completely different code", () => {
    const leftCode = "aaa\nbbb";
    const rightCode = "xxx\nyyy";
    const leftHtml = fakeShikiHtml(["aaa", "bbb"]);
    const rightHtml = fakeShikiHtml(["xxx", "yyy"]);
    const result = computeDiff(leftCode, rightCode, leftHtml, rightHtml);

    const types = result.unified.map((l) => l.type);
    expect(types.filter((t) => t === "remove").length).toBe(2);
    expect(types.filter((t) => t === "add").length).toBe(2);
  });

  it("handles one line added at the start", () => {
    const leftCode = "same1\nsame2";
    const rightCode = "new\nsame1\nsame2";
    const leftHtml = fakeShikiHtml(["same1", "same2"]);
    const rightHtml = fakeShikiHtml(["new", "same1", "same2"]);
    const result = computeDiff(leftCode, rightCode, leftHtml, rightHtml);

    // Left side should have a spacer at index 0
    expect(result.left[0].type).toBe("spacer");
    // Right side should have an add at index 0
    expect(result.right[0].type).toBe("add");
    // Remaining lines should be same
    expect(result.left[1].type).toBe("same");
    expect(result.right[1].type).toBe("same");
  });
});
