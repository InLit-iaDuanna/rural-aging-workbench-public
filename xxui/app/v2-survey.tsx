'use client';
import { useMemo } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.min.css';
import { forms } from '@/lib/v2/forms';
export default function FieldSurvey({
  type,
  initial,
  onSave,
}: {
  type: keyof typeof forms;
  initial: any;
  onSave: (data: any) => Promise<void>;
}) {
  const model = useMemo(() => {
    const m = new Model(forms[type]);
    m.data = initial;
    m.onComplete.add(async (sender, options) => {
      options.showSaveInProgress('正在保存…');
      try {
        await onSave(sender.data);
        options.showSaveSuccess('已保存，可继续处理下一条记录');
      } catch (e) {
        options.showSaveError(e instanceof Error ? e.message : '保存失败');
      }
    });
    return m;
  }, [type, initial, onSave]);
  return <Survey model={model} />;
}
