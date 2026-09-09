import { runProcess } from '../server/cli';
import { tmpdir } from 'node:os';
const raw = await runProcess(
  'codebuddy',
  [
    '--print',
    '--output-format',
    'json',
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--no-session-persistence',
    '--max-turns',
    '2',
    '--permission-mode',
    'dontAsk',
  ],
  '仅返回 JSON 对象 {"action":"request_help","target_id":null,"reason":"合成连通性测试"}',
  { cwd: tmpdir() },
);
const parsed = JSON.parse(raw);
console.log(
  JSON.stringify(
    Array.isArray(parsed)
      ? parsed.map((x) => ({
          type: x.type,
          keys: Object.keys(x),
          ...(x.type === 'result'
            ? { result: x.result, structured_output: x.structured_output }
            : {}),
        }))
      : { keys: Object.keys(parsed), result: parsed.result },
    null,
    2,
  ),
);
