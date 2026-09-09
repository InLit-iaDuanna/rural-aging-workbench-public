import { execute } from '../server/cli';
import { decisionSchema } from '../lib/v2/schema';
for (const executor of ['codebuddy', 'codex'] as const) {
  const start = Date.now();
  try {
    const result = await execute(
      executor,
      {
        synthetic: true,
        instruction: '这是合成连通性测试。请选择唯一合法动作。',
        legal: [{ action: 'request_help', target_id: null }],
      },
      decisionSchema,
    );
    console.log(
      JSON.stringify({
        executor,
        ok: true,
        elapsed_ms: Date.now() - start,
        result,
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        executor,
        ok: false,
        elapsed_ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
