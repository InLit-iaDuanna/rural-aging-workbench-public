'use client';
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  type ThreadMessageLike,
} from '@assistant-ui/react';
export default function VillageAssistant({
  messages,
  running,
  onSend,
  onCancel,
}: {
  messages: ThreadMessageLike[];
  running: boolean;
  onSend: (text: string) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage: (message: ThreadMessageLike) => message,
    isRunning: running,
    onNew: async (message) => {
      const text = message.content
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      await onSend(text);
    },
    onCancel,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="v2-assistant">
        <ThreadPrimitive.Viewport className="v2-chat-scroll">
          <ThreadPrimitive.Empty>
            <p>
              选中一条反馈后，让助手调用空间与证据工具。所有正式行动仍需复核与确认。
            </p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ UserMessage: User, AssistantMessage: Assistant }}
          />
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root className="v2-composer">
          <ComposerPrimitive.Input
            placeholder="补充本次分析关注的问题…"
            aria-label="分析需求"
          />
          <ComposerPrimitive.Send>发送</ComposerPrimitive.Send>
          {running && (
            <ComposerPrimitive.Cancel>取消运行</ComposerPrimitive.Cancel>
          )}
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
function User() {
  return (
    <MessagePrimitive.Root className="v2-message user">
      <small>你的需求</small>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
function Assistant() {
  return (
    <MessagePrimitive.Root className="v2-message">
      <small>乡筑 · 执行记录</small>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
