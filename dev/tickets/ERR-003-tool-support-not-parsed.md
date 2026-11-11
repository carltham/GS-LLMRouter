# ERR-003: Tool support field is not parsed

Severity: Medium. Status: Open.

## Symptom
Tool support is stored as unknown for models that do support tools.

## Evidence (observed)
- RouteLLM returns `tools: true` for the sampled text models.
- `src/catalog.ts` reads `supports_tools`, `tool_calling` or `function_calling` only.
- Requests that carry tools are classed complex and need tool support, so this affects routing of
  tool requests. (Whether unknown tool support makes a model ineligible was not re-checked.)

## Expected
`tools` is read and stored as tool support.
