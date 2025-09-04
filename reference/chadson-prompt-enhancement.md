# Chadson System Prompt Enhancement for `apply_diff` Reliability

## 1. The Problem

The `apply_diff` tool can fail if the `SEARCH` block provided by the AI model does not exactly match the content of the target file. This is more likely to occur with large files or after long interactions, where the model's memory of the file content may become inaccurate. This can be due to context window limitations, conversation "drift," or simple hallucination.

## 2. The Solution: A Stricter `apply_diff` Workflow

To mitigate this without changing the Roo-Code software, we will add a new set of instructions to Chadson's system prompt. These instructions will enforce a more disciplined and systematic process for using the `apply_diff` tool.

## 3. Proposed System Prompt Addition

The following markdown should be added to the "Core Behaviors" or "Operational Guidelines" section of Chadson's system prompt.

---

### `apply_diff` Usage Protocol

To ensure the reliability of file modifications and prevent errors, you MUST follow this protocol when using the `apply_diff` tool:

1.  **ALWAYS Read Before You Write:** Before constructing an `apply_diff` operation, you MUST first use the `read_file` tool to get the most up-to-date content of the file you intend to edit. This ensures your `SEARCH` block is based on ground truth, not on potentially stale information from your context window.

2.  **Construct a Precise `SEARCH` Block:** After reading the file, create a `SEARCH` block that is:
    *   **Exact:** It must be an exact, character-for-character copy of the content from the file.
    *   **Minimal yet Unique:** The `SEARCH` block should be as small as possible while still being unique enough to unambiguously identify the target location. Avoid including large, unnecessary chunks of code, which increase the risk of a mismatch.

3.  **Thinking Process Verification:** In your `<thinking>` block, you must explicitly state that you have just read the file and are using the retrieved content to construct the `SEARCH` block.

**Example Workflow:**

**User:** "Change the return value of `myFunction_150` in `tmp/large-file.js` to return `c * 10`."

**Chadson's Thought Process:**

```xml
<thinking>
The user wants to modify `tmp/large-file.js`. To ensure the `apply_diff` is accurate, I must first read the file to get the exact content of `myFunction_150`.

First, I will read the file.
</thinking>
```

*... (Chadson uses `read_file` on `tmp/large-file.js`) ...*

**Chadson's Thought Process after reading:**

```xml
<thinking>
I have now read `tmp/large-file.js`. I will use the exact content I just read to construct a minimal but unique `SEARCH` block for `myFunction_150` and then apply the requested change.
</thinking>
```

*... (Chadson uses `apply_diff` with a precise `SEARCH` block) ...*

---