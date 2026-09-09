'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Leaf,
  Plus,
  ArrowUpRight,
  Search,
  FolderOpen,
  MapPin,
  Layers,
  ArrowRight,
  FileText,
  Settings,
  Check,
  Upload,
  Satellite,
  Image as ImageIcon,
  Send,
  Sparkles,
  Download,
  PanelRightClose,
  MessageCircle,
  Trash2,
  LocateFixed,
  CheckCircle2,
  ChevronDown,
  Building2,
  BookOpen,
  GripVertical,
  Link2,
  Unlink,
  Play,
  Users,
  AlertTriangle,
  Clock,
  ShieldCheck,
  GitCompare,
  Accessibility,
  Box,
  Route,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Landing from './landing';
import type { Spatial } from '@/lib/spatial';
type WorkspacePanel = 'archive' | 'debug' | 'plans';
type WorkspacePage = 'home' | 'workspace' | WorkspacePanel;
type Photo = {
  id: string;
  name: string;
  category: string;
  src: string;
  note?: string;
};
type Mark = {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: string;
  observation?: string;
  status?: '待核实' | '已确认';
};
type DebugRun = {
  id: string;
  title: string;
  scenarios: string[];
  status: '待建模' | '资料准备中' | '待专业复核';
  created: string;
  note: string;
};
type Plan = {
  id: string;
  title: string;
  body: string;
  scene?: string;
  scope?: string;
  references?: string;
  innovation?: string;
  compliance?: string;
  implementation?: string;
  cost?: string;
  maintenance?: string;
  verification?: string;
  tradeoffs?: string;
  tasks?: string[];
};
type PlanTextField = Exclude<keyof Plan, 'tasks'>;
type Project = {
  spatial?: Spatial;
  id: string;
  name: string;
  address: string;
  updated: string;
  fields: Record<string, string>;
  facilities: string[];
  photos: Photo[];
  marks: Mark[];
  debugScenarios: string[];
  debugRuns: DebugRun[];
  plans: Plan[];
  current: string;
};
type KnowledgeLayer = {
  title: string;
  purpose: string;
  trace: string;
};
const knowledgeLayers: KnowledgeLayer[] = [
  {
    title: '法规、规范与政策依据',
    purpose: '校验安全、尺寸、审批与责任边界',
    trace: '保留条文、地区与版本',
  },
  {
    title: '乡村适老化原则与评估',
    purpose: '围绕安全、独立使用、识路、停留与求助判断',
    trace: '记录评估方法与适用条件',
  },
  {
    title: '国内外公共空间案例',
    purpose: '迁移可验证的场景做法，而非套用模板',
    trace: '标注案例地区与可迁移范围',
  },
  {
    title: '环境分析',
    purpose: '核对地形、气候、日照、雨水、积水与照明',
    trace: '关联现场资料与分析时间',
  },
  {
    title: '材料、节点与施工做法',
    purpose: '判断建造条件、成本、施工影响和维护要求',
    trace: '保留材料参数与施工来源',
  },
  {
    title: '老人行为与使用场景',
    purpose: '组织行走、停顿、绕行、休息、识路、如厕与求助',
    trace: '关联人物特征与观察证据',
  },
  {
    title: '项目复盘与失败经验',
    purpose: '识别效果、失效原因与长期维护风险',
    trace: '记录项目阶段与证据等级',
  },
];
const panelMeta: {
  id: WorkspacePanel;
  title: string;
  sub: string;
  Icon: typeof FolderOpen;
}[] = [
  { id: 'archive', title: '档案', sub: '村庄与老人需求', Icon: FolderOpen },
  { id: 'debug', title: '调试', sub: '3D 与行为脚本', Icon: Play },
  { id: 'plans', title: '方案', sub: '比较、依据与复核', Icon: FileText },
];
const behaviorScenarios = [
  '行走',
  '停顿',
  '绕行',
  '休息',
  '识路',
  '如厕',
  '求助',
];
const photoCategories = [
  {
    title: '卫星航拍图',
    sub: '了解道路、居住点与设施的整体关系',
    Icon: Satellite,
    preview: '/gallery-satellite-map.webp',
    tone: 'green',
  },
  {
    title: '重点区域与道路',
    sub: '记录高差、积水、断点与建设约束',
    Icon: MapPin,
    preview: '/gallery-priority-map.webp',
    tone: 'peach',
  },
  {
    title: '村庄场景图片',
    sub: '留存老人真实使用与停留场景',
    Icon: ImageIcon,
    preview: '/countryside.png',
    tone: 'peach',
  },
];
const sample: Project = {
  id: 'qingxi',
  name: '青溪村 · 适老化建设计划',
  address: '浙江省 / 杭州市 / 桐庐县 / 分水镇 / 青溪村',
  updated: '2026-09-08',
  fields: {
    area: '12.6',
    households: '386',
    population: '1128',
    elderlyPopulation: '361',
    old: '32',
    livingAlone: '46',
    mobilityLimited: '28',
    economy: '生态农业',
    budget: '50–100 万元',
    notes:
      '以水稻种植、乡村旅游为主，保留传统村落肌理。重点关注老人从居住点到卫生室、助餐点和文化礼堂的日常路径。',
    elderProfiles:
      '高龄独居老人主要分布在老村组；部分老人使用手杖，雨天外出频率明显下降。',
    elderBehaviors:
      '上午前往集市和卫生室，傍晚在村口、文化礼堂附近停留；连续步行约 150–200 米后需要休息。',
    elderNeeds:
      '连续防滑慢行路径、可辨识导向、遮阴休息点、夜间照明、就近如厕与紧急求助。',
    roads: '主路基本硬化，支路局部坡陡、路缘高差明显，雨后易积水。',
    residential: '居住点较分散，老村组与公共服务设施之间存在步行距离和高差。',
    priorityAreas: '卫生室—文化礼堂—村口集市之间的日常活动路径。',
    constraints:
      '村道宽度有限；传统村落风貌需保留；部分用地权属和排水条件待核实。',
    cases: '待从知识库补充具有相似地形、气候与人口结构的案例。',
    userRequirements: '优先做低干扰、可分期、便于村级维护的改造。',
    designGoals: '让老人可以更安全、独立地完成出行、休息、识路、如厕与求助。',
    openQuestions:
      '雨天积水范围、夜间照度、公共厕所开放时段、重点老人真实步行路线待现场核实。',
    fieldNotes: '现场调研记录待继续补充。',
    elderPersona:
      '以 70–85 岁、可独立或借助手杖出行的老人作为第一阶段重点人物。',
    mobilityConstraints:
      '步速较慢、连续步行距离有限，对高差、湿滑路面和复杂导向更敏感。',
    testGoal: '检验日常公共服务路径是否连续、可休息、可识别并可及时求助。',
  },
  facilities: ['村委会', '卫生室', '助餐点', '文化礼堂', '公共厕所'],
  photos: [
    {
      id: 'scene-qingxi',
      name: '青溪村场景示意',
      category: '村庄场景图片',
      src: '/countryside.png',
      note: '用于原型界面展示，真实项目需替换为现场资料。',
    },
  ],
  marks: [],
  debugScenarios: ['行走', '停顿', '休息', '识路', '求助'],
  debugRuns: [],
  plans: [
    {
      id: 'p1',
      title: '连续慢行与休憩网络 · 方案 A',
      body: '老人从老村组前往卫生室、助餐点和文化礼堂时，需要经过坡陡、路缘高差和缺少休息点的路段。雨天湿滑与积水会进一步降低独立出行意愿。',
      scene:
        '重点影响使用手杖、步速较慢及需要中途休息的老人，覆盖就医、就餐、社交与日常采购。',
      scope: '卫生室—文化礼堂—村口集市的高频慢行路径及沿线节点。',
      references:
        '关联乡村适老化评估、无障碍通行、安全照明与休憩设施资料；具体条文和尺寸待知识库核验。',
      innovation:
        '把连续通行、短距离休息、识路和求助整合为一条可分期建设的日常生活支持网络。',
      compliance:
        '涉及坡度、防滑、扶手、照明与无障碍尺寸的内容需由专业人员按项目所在地现行规范复核。',
      implementation:
        '先处理高频危险点和断点，再补充休息、导向及求助节点；施工期间保留基本通行。',
      cost: '中等；可按关键节点、连续路段、服务网络三期实施。',
      maintenance:
        '明确村级巡检责任，雨季重点检查排水、防滑面层、照明和座椅稳固性。',
      verification:
        '需核实真实步行路线、坡度与高差、雨天积水、夜间照度、土地权属和维护主体。',
      tradeoffs: '覆盖面较广、连续性强，但前期测绘与多节点协调量较大。',
    },
    {
      id: 'p2',
      title: '邻里照护微节点 · 方案 B',
      body: '分散居住使部分高龄老人难以持续到达中心公共设施，日常停留、短时照护和求助节点不足。',
      scene: '面向高龄独居、活动半径较小及需要邻里照看的老人。',
      scope: '老村组入口、巷道交汇处及现有闲置小空间。',
      references:
        '关联老人行为场景、邻里照护案例和公共设施维护经验；来源待知识库补充。',
      innovation:
        '以小尺度、可维护的邻里节点缩短支持距离，并与村级照护联络机制结合。',
      compliance:
        '不得占用消防、应急和必要通行空间，构筑物安全与用地条件需复核。',
      implementation:
        '优先选择权属清晰、邻里参与度高的两处节点试点，再根据使用反馈扩展。',
      cost: '低至中等；单点投入较小，后续网络化需持续运营。',
      maintenance: '由村集体与邻里志愿者共同巡查，明确设施报修和紧急联络流程。',
      verification:
        '需核实老人分布、实际停留点、邻里照护意愿、权属和消防条件。',
      tradeoffs: '启动快、干扰小，但服务覆盖依赖节点分布和日常运营。',
    },
    {
      id: 'p3',
      title: '公共服务识路提升 · 方案 C',
      body: '公共服务设施之间缺少统一、易辨认的导向，转折点和夜间环境容易造成犹豫与绕行。',
      scene: '面向视力下降、记忆与方向判断能力减弱的老人，也兼顾外来访客。',
      scope: '村口、主要路口、卫生室、助餐点、公共厕所和文化礼堂。',
      references:
        '关联认知友好导向、夜间照明和乡村风貌协调方法；参数待专业复核。',
      innovation: '以地标、色彩、距离提示和连续照明组成低文字依赖的识路系统。',
      compliance:
        '标识设置不得影响交通安全，照明、用电和结构固定应按现行要求复核。',
      implementation:
        '先以可移除标识开展路径测试，再定稿材料、位置与夜间照明。',
      cost: '低至中等；适合快速试点和迭代。',
      maintenance: '定期检查可见度、遮挡、褪色、照明和信息准确性。',
      verification:
        '需组织老人实走测试，核实视距、理解度、夜间效果及风貌协调。',
      tradeoffs: '见效快、成本可控，但不能替代通行空间本身的安全改造。',
    },
  ],
  current: 'p1',
};
function normalizeProject(value: Project): Project {
  const plans = (value.plans || []).map((plan) => ({
    scene: '',
    scope: '',
    references: '',
    innovation: '',
    compliance: '',
    implementation: '',
    cost: '',
    maintenance: '',
    verification: '',
    tradeoffs: '',
    tasks: [],
    ...plan,
  }));
  return {
    ...sample,
    ...value,
    fields: { ...value.fields },
    facilities: value.facilities || [],
    photos: value.photos || [],
    marks: (value.marks || []).map((mark) => ({
      observation: '',
      status: '待核实',
      ...mark,
    })),
    debugScenarios: value.debugScenarios || [],
    debugRuns: value.debugRuns || [],
    plans,
    current: value.current || plans[0]?.id || '',
  };
}
function readDB(): Promise<Project[] | undefined> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('xiangzhu-workspace', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('data');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const q = db.transaction('data').objectStore('data').get('projects');
      q.onsuccess = () => {
        resolve(q.result);
        db.close();
      };
      q.onerror = () => reject(q.error);
    };
  });
}
function writeDB(data: Project[]) {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.open('xiangzhu-workspace', 1);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result,
        t = db.transaction('data', 'readwrite');
      t.objectStore('data').put(data, 'projects');
      t.oncomplete = () => {
        db.close();
        resolve();
      };
      t.onerror = () => reject(t.error);
    };
  });
}
export default function Workspace() {
  const [projects, setProjects] = useState<Project[]>([sample]);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<WorkspacePage>('debug');
  const [active, setActive] = useState('qingxi');
  const [tab, setTab] = useState('basic');
  const [debugTab, setDebugTab] = useState('map');
  const [assistant, setAssistant] = useState(true);
  const [lastPanel, setLastPanel] = useState<WorkspacePanel>('archive');
  const [attachedPanel, setAttachedPanel] = useState<WorkspacePanel | null>(
    null,
  );
  const [draggingPanel, setDraggingPanel] = useState<WorkspacePanel | null>(
    null,
  );
  const [dragOverAssistant, setDragOverAssistant] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(['p1', 'p2']);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState('正在载入');
  const [category, setCategory] = useState('卫星航拍图');
  const [markKind, setMarkKind] = useState('通行障碍');
  const [selectedPlan, setSelectedPlan] = useState('p1');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<
    { role: string; text: string; context?: WorkspacePanel }[]
  >([]);
  const [editing, setEditing] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const project = projects.find((p) => p.id === active) || projects[0];
  const plan =
    project.plans.find((p) => p.id === selectedPlan) || project.plans[0];
  const comparisonPlans = compareIds
    .map((id) => project.plans.find((item) => item.id === id))
    .filter((item): item is Plan => Boolean(item));
  const satellite = project.photos.find((p) => p.category === '卫星航拍图');
  const openPanel: WorkspacePanel | null = panelMeta.some(
    (item) => item.id === page,
  )
    ? (page as WorkspacePanel)
    : null;
  const conversationPanel: WorkspacePanel =
    attachedPanel || openPanel || lastPanel;
  const conversationTitle =
    panelMeta.find((item) => item.id === conversationPanel)?.title || '档案';
  useEffect(() => {
    readDB()
      .then((p) => {
        if (p?.length) {
          setProjects(p.map(normalizeProject));
          setActive(p[0].id);
        }
        setReady(true);
        setSaved('已保存到本机');
      })
      .catch(() => {
        setReady(true);
        setSaved('本机存储不可用');
      });
    const hash = () => {
      const hashValue = location.hash.slice(1);
      const v = hashValue === 'survey' ? 'debug' : hashValue;
      if (['home', 'workspace', 'archive', 'debug', 'plans'].includes(v))
        setPage(v as WorkspacePage);
    };
    hash();
    window.addEventListener('hashchange', hash);
    window.addEventListener('popstate', hash);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('popstate', hash);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      writeDB(projects)
        .then(() => setSaved('已保存到本机'))
        .catch(() => setSaved('保存失败，请导出备份'));
    }, 300);
    return () => clearTimeout(id);
  }, [projects, ready]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(
    () => end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    [messages],
  );
  function navigate(v: WorkspacePage) {
    setPage(v);
    window.history.pushState(null, '', `#${v}`);
    setEditing(false);
  }
  function togglePanel(panel: WorkspacePanel) {
    setLastPanel(panel);
    if (page === panel) {
      navigate('workspace');
      return;
    }
    navigate(panel);
  }
  function attachToAssistant(panel: WorkspacePanel) {
    setLastPanel(panel);
    setAttachedPanel(panel);
    setAssistant(true);
    setDragOverAssistant(false);
    navigate('workspace');
    setNotice(
      `已将“${panelMeta.find((item) => item.id === panel)?.title}”附加到对话`,
    );
  }
  function update(fn: (p: Project) => Project) {
    setProjects((all) =>
      all.map((p) =>
        p.id === active ? { ...fn(p), updated: new Date().toISOString() } : p,
      ),
    );
  }
  function openProject(id: string) {
    setActive(id);
    setLastPanel('archive');
    setMessages([]);
    setAttachedPanel(null);
    setComparing(false);
    setSelectedPlan(projects.find((p) => p.id === id)?.plans[0]?.id || '');
    navigate('archive');
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (...args: unknown[]) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'navigate_village_workspace',
          description:
            'Open or collapse the archive, debugging or plans panel of the current age-friendly village project.',
          inputSchema: {
            type: 'object',
            properties: {
              page: {
                type: 'string',
                enum: ['home', 'workspace', 'archive', 'debug', 'plans'],
              },
            },
            required: ['page'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input: unknown) {
            const value = (input as { page?: string })?.page;
            if (
              !value ||
              !['home', 'workspace', 'archive', 'debug', 'plans'].includes(
                value,
              )
            )
              throw new Error('Unknown workspace page');
            navigate(value as WorkspacePage);
            return { page: value };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  function create() {
    if (!name.trim()) return;
    if (dialog === 'project') {
      const id = crypto.randomUUID();
      setProjects((p) => [
        ...p,
        {
          id,
          name: name.trim(),
          address: '',
          updated: new Date().toISOString(),
          fields: {},
          facilities: [],
          photos: [],
          marks: [],
          debugScenarios: [],
          debugRuns: [],
          plans: [],
          current: '',
        },
      ]);
      setActive(id);
      navigate('archive');
    } else {
      const id = crypto.randomUUID();
      update((p) => ({
        ...p,
        plans: [
          {
            id,
            title: name.trim(),
            body: '说明问题依据，以及受影响的老人使用场景。',
            scene: '',
            scope: '',
            references: '',
            innovation: '',
            compliance: '',
            implementation: '',
            cost: '',
            maintenance: '',
            verification: '',
            tradeoffs: '',
            tasks: [],
          },
          ...p.plans,
        ],
        current: p.current || id,
      }));
      setSelectedPlan(id);
      navigate('plans');
    }
    setDialog('');
    setName('');
    setNotice('创建成功');
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    const photos: Photo[] = [];
    for (const f of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setNotice('请选择 JPG、PNG 或 WebP 图片');
        continue;
      }
      if (f.size > 15 * 1024 * 1024) {
        setNotice('单张图片请小于 15 MB');
        continue;
      }
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('图片读取失败'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      photos.push({ id: crypto.randomUUID(), name: f.name, category, src });
    }
    update((p) => ({ ...p, photos: [...p.photos, ...photos] }));
    if (photos.length) setNotice(`已添加 ${photos.length} 张图片`);
    if (file.current) file.current.value = '';
  }
  function addMapMark(x: number, y: number) {
    update((p) => ({
      ...p,
      marks: [
        ...p.marks,
        {
          id: crypto.randomUUID(),
          x,
          y,
          label: `${markKind} ${p.marks.length + 1}`,
          kind: markKind,
          observation: '',
          status: '待核实',
        },
      ],
    }));
  }
  function send(text = message) {
    if (!text.trim()) return;
    const reply =
      conversationPanel === 'debug'
        ? `已把问题放入“调试”通道。当前有 ${project.photos.length} 份场景影像、${project.marks.length} 个空间问题标记和 ${project.debugRuns.length} 条调试任务。当前原型可以整理场景输入与老人行为脚本；可编辑 3D 场景和 AI NPC 仿真仍待接入，任何候选发现都需要现场核实。`
        : conversationPanel === 'plans'
          ? `已把问题放入“方案”通道。当前正在查看「${plan?.title || '新方案'}」。请同时核对问题场景、适用空间、知识依据、创新价值、合规边界、成本维护和待复核事项；关键判断需能追溯到档案、调试、知识库或你的确认。`
          : `已把问题放入“档案”通道。「${project.name}」现有 ${project.facilities.length} 类设施、${project.photos.length} 份影像。建议优先核对老人画像、真实活动路线、休息与如厕需求、建设约束和待核实问题，再进入调试。`;
    setMessages((m) => [
      ...m,
      { role: 'user', text, context: conversationPanel },
      {
        role: 'assistant',
        text: reply,
        context: conversationPanel,
      },
    ]);
    setMessage('');
  }
  function updatePlanField(field: PlanTextField, value: string) {
    if (!plan) return;
    update((p) => ({
      ...p,
      plans: p.plans.map((item) =>
        item.id === plan.id ? { ...item, [field]: value } : item,
      ),
    }));
  }
  function toggleScenario(scenario: string, checked: boolean) {
    update((p) => ({
      ...p,
      debugScenarios: checked
        ? Array.from(new Set([...p.debugScenarios, scenario]))
        : p.debugScenarios.filter((item) => item !== scenario),
    }));
  }
  function createDebugRun() {
    if (!project.debugScenarios.length) {
      setNotice('请先选择至少一个老人使用场景');
      return;
    }
    const run: DebugRun = {
      id: crypto.randomUUID(),
      title: `行为调试任务 ${project.debugRuns.length + 1}`,
      scenarios: project.debugScenarios,
      status: '待建模',
      created: new Date().toISOString(),
      note: project.fields.testGoal || '调试目标待补充。',
    };
    update((p) => ({ ...p, debugRuns: [run, ...p.debugRuns] }));
    setDebugTab('runs');
    setNotice('已保存调试任务；尚未运行真实 3D / NPC 仿真');
  }
  function toggleComparePlan(id: string) {
    setCompareIds((ids) =>
      ids.includes(id)
        ? ids.filter((item) => item !== id)
        : [...ids.slice(-1), id],
    );
  }
  function renderPlanField(field: PlanTextField, placeholder: string) {
    const value = plan?.[field] || '';
    return editing ? (
      <textarea
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(event) => updatePlanField(field, event.target.value)}
      />
    ) : (
      <p className={field === 'body' ? 'plan-body' : ''}>
        {value || `待补充：${placeholder}`}
      </p>
    );
  }
  function download() {
    const planText = plan
      ? [
          plan.title,
          `\n一、问题依据与老人使用场景\n${plan.body}\n${plan.scene || ''}`,
          `\n二、适用空间与建设对象\n${plan.scope || '待补充'}`,
          `\n三、案例、规范与研究关联\n${plan.references || '待核验'}`,
          `\n四、创新点与具体价值\n${plan.innovation || '待补充'}`,
          `\n五、合规、实施、成本与维护\n合规：${plan.compliance || '待专业复核'}\n实施：${plan.implementation || '待补充'}\n成本：${plan.cost || '待估算'}\n维护：${plan.maintenance || '待明确'}`,
          `\n六、方案取舍\n${plan.tradeoffs || '待比较'}`,
          `\n七、尚需核实与确认\n${plan.verification || '待补充'}`,
          '\n说明：本方案为辅助建议，不能替代专业勘察、设计、审批、施工、监理、检测和验收。',
        ].join('\n')
      : '';
    const blob = new Blob(
      [page === 'plans' && plan ? planText : JSON.stringify(project, null, 2)],
      { type: 'text/plain;charset=utf-8' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${page === 'plans' ? plan?.title : project.name}.${page === 'plans' ? 'txt' : 'json'}`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice('已导出到下载文件夹');
  }
  return (
    <div className={`site ${page !== 'home' ? 'workspace-site' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={() => navigate('home')}>
          <span className="brand-mark">
            <Leaf />
          </span>
          乡筑<span className="brand-en">XIANGZHU</span>
        </button>
        <div className="top-caption">
          以适老化为主线，
          <br />
          让建设判断更有依据。
        </div>
        {page !== 'home' && (
          <span className="top-poem">让老人安心行走，也安心停留。</span>
        )}
        <div className="profile">
          <span className="status-dot" />
          {saved}
          <span className="avatar">Z</span>张工
        </div>
      </header>
      {page === 'home' ? (
        <Landing
          projects={projects}
          onOpen={openProject}
          onCreate={() => {
            setDialog('project');
            setName('');
          }}
        />
      ) : (
        <SidebarProvider className="workspace">
          <Sidebar collapsible="none" className="village-sidebar panel-rail">
            <div className="project-switch">
              <span>当前项目</span>
              <button onClick={() => navigate('home')}>
                {project.name.split(' · ')[0]}
                <ChevronDown size={16} />
              </button>
            </div>
            <SidebarContent>
              <TooltipProvider delay={250}>
                <SidebarMenu>
                  {panelMeta.map(({ id, title, sub, Icon }) => (
                    <SidebarMenuItem
                      key={id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/workspace-panel', id);
                        event.dataTransfer.effectAllowed = 'link';
                        setDraggingPanel(id);
                        setAssistant(true);
                      }}
                      onDragEnd={() => {
                        setDraggingPanel(null);
                        setDragOverAssistant(false);
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <SidebarMenuButton
                              className={`nav-item panel-bubble ${page === id ? 'selected' : ''} ${attachedPanel === id ? 'attached' : ''}`}
                              isActive={page === id}
                              onClick={() => togglePanel(id)}
                              aria-label={`${page === id ? '收起' : '展开'}${title}板块；也可拖到对话区`}
                            >
                              <Icon />
                              <b>{title}</b>
                              {attachedPanel === id ? (
                                <Link2 className="panel-link-state" />
                              ) : (
                                <GripVertical className="drag-handle" />
                              )}
                            </SidebarMenuButton>
                          }
                        />
                        <TooltipContent
                          side="right"
                          sideOffset={12}
                          className="panel-tooltip"
                        >
                          {sub}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </TooltipProvider>
            </SidebarContent>
            <button
              className="settings-button"
              onClick={() => setDialog('settings')}
            >
              <Settings size={20} />
              <span>工作台设置</span>
            </button>
            <button
              className="settings-button"
              onClick={() => setDialog('knowledge')}
            >
              <BookOpen size={20} />
              <span>知识库结构</span>
            </button>
            <div className="side-note">
              适老为先
              <br />
              合规为底
            </div>
          </Sidebar>
          <main
            className={`work-main ${!assistant ? 'wide' : ''} ${page === 'workspace' && assistant ? 'conversation-only' : ''}`}
          >
            <div className="work-columns">
              {!(page === 'workspace' && assistant) && (
                <section
                  className={`main-surface ${page === 'plans' ? 'plan-surface' : 'glass'} ${page === 'workspace' ? 'overview-surface' : ''} ${page === 'archive' && tab === 'basic' ? 'archive-basic-surface' : ''} ${page === 'archive' && tab === 'photos' ? 'archive-gallery-surface' : ''}`}
                >
                  {page === 'workspace' && (
                    <div className="workbench-overview">
                      <div className="work-heading">
                        <div className="heading-icon">
                          <Accessibility />
                        </div>
                        <div>
                          <div className="eyebrow">
                            AGE-FRIENDLY VILLAGE WORKBENCH
                          </div>
                          <h1>乡村适老化建设辅助工作台</h1>
                          <p>
                            在同一个项目里组织真实资料、使用行为、调试判断与可比较方案。
                          </p>
                        </div>
                        <span className="pill prototype-pill">
                          <Clock size={12} /> 当前阶段 · 交互原型
                        </span>
                      </div>
                      <div className="workflow-cards">
                        {panelMeta.map(({ id, title, Icon }, index) => (
                          <button
                            key={id}
                            className="workflow-card"
                            onClick={() => togglePanel(id)}
                          >
                            <span className="workflow-index">0{index + 1}</span>
                            <Icon />
                            <b>{title}</b>
                            <small>
                              {id === 'archive'
                                ? '记录村庄、老人、空间与约束'
                                : id === 'debug'
                                  ? '定义场景、问题与老人行为脚本'
                                  : '整合依据并形成可比较方案'}
                            </small>
                            <ArrowRight />
                          </button>
                        ))}
                      </div>
                      <div className="logic-loop">
                        <div>
                          <BookOpen />
                          <span>
                            <b>知识库贯穿全过程</b>
                            <small>
                              规范、案例、方法与适用条件为判断提供依据
                            </small>
                          </span>
                        </div>
                        <ArrowRight />
                        <div>
                          <MessageCircle />
                          <span>
                            <b>AI 对话持续质疑与修正</b>
                            <small>
                              拖动左侧任一板块到对话区，建立单一通道
                            </small>
                          </span>
                        </div>
                      </div>
                      <div className="boundary-note">
                        <AlertTriangle />
                        <p>
                          当前网页用于整理资料和验证交互流程。可编辑 3D 场景与
                          AI NPC
                          仿真将分阶段接入；输出不能替代专业勘察、设计、审批、施工和验收。
                        </p>
                      </div>
                    </div>
                  )}
                  {page === 'archive' && (
                    <>
                      <div className="work-heading archive-heading">
                        <div className="heading-icon">
                          <Leaf />
                        </div>
                        <div>
                          <h1>村庄适老化档案</h1>
                          <p>
                            把村庄资料、老人需求、空间条件与待核实问题整理为调试底板。
                          </p>
                        </div>
                        <Tabs
                          value={tab === 'photos' ? 'photos' : 'basic'}
                          onValueChange={(value) => setTab(String(value))}
                          className="archive-tabs-control"
                        >
                          <TabsList className="village-tabs archive-two-tabs">
                            <TabsTrigger value="basic">基本信息</TabsTrigger>
                            <TabsTrigger value="photos">
                              图片库
                              <span className="mini-count">
                                {project.photos.length}
                              </span>
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      {tab !== 'photos' ? (
                        <div className="form-scroll">
                          <section className="form-section">
                            <h2>
                              <Building2 />
                              村庄概况<span>VILLAGE PROFILE</span>
                            </h2>
                            <label className="field full">
                              村庄地址
                              <div className="input-wrap">
                                <MapPin size={16} />
                                <input
                                  value={project.address}
                                  placeholder="省 / 市 / 县 / 乡镇 / 村"
                                  onChange={(e) =>
                                    update((p) => ({
                                      ...p,
                                      address: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </label>
                            <div className="field-grid">
                              {[
                                ['area', '村庄面积', '平方公里'],
                                ['households', '常住户数', '户'],
                                ['population', '常住人口', '人'],
                                ['elderlyPopulation', '老年人口', '人'],
                              ].map(([key, label, unit]) => (
                                <label className="field" key={key}>
                                  {label}
                                  <div className="input-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      value={project.fields[key] || ''}
                                      placeholder="待补充"
                                      onChange={(e) =>
                                        update((p) => ({
                                          ...p,
                                          fields: {
                                            ...p.fields,
                                            [key]: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                    <span>{unit}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </section>
                          <section className="form-section">
                            <h2>
                              <Layers />
                              公共设施基础<span>可多选</span>
                            </h2>
                            <div className="facility-list">
                              {[
                                '村委会',
                                '卫生室',
                                '助餐点',
                                '文化礼堂',
                                '公共厕所',
                                '停车点',
                                '健身场地',
                                '集市商店',
                              ].map((f) => (
                                <label
                                  key={f}
                                  className={
                                    project.facilities.includes(f)
                                      ? 'checked'
                                      : ''
                                  }
                                >
                                  <Checkbox
                                    checked={project.facilities.includes(f)}
                                    onCheckedChange={(checked) =>
                                      update((p) => ({
                                        ...p,
                                        facilities: checked
                                          ? [...p.facilities, f]
                                          : p.facilities.filter((x) => x !== f),
                                      }))
                                    }
                                  />
                                  {f}
                                </label>
                              ))}
                            </div>
                          </section>
                          <section className="form-section">
                            <h2>
                              <LocateFixed />
                              发展条件与建设期望<span>规划的起点</span>
                            </h2>
                            <div className="field-grid">
                              {[
                                ['economy', '主要经济模式'],
                                ['budget', '建设预算'],
                              ].map(([key, label]) => (
                                <label className="field" key={key}>
                                  {label}
                                  <input
                                    className="plain-input"
                                    value={project.fields[key] || ''}
                                    placeholder={
                                      key === 'economy'
                                        ? '例如：生态农业、乡村旅游'
                                        : '例如：50–100 万元'
                                    }
                                    onChange={(e) =>
                                      update((p) => ({
                                        ...p,
                                        fields: {
                                          ...p.fields,
                                          [key]: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                            <label className="field full">
                              补充说明
                              <textarea
                                value={project.fields.notes || ''}
                                placeholder="记录村庄特色、发展愿景与当前需求…"
                                onChange={(e) =>
                                  update((p) => ({
                                    ...p,
                                    fields: {
                                      ...p.fields,
                                      notes: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </section>
                          <section className="form-section">
                            <h2>
                              <Users />
                              老人情况与使用需求<span>适老化判断基础</span>
                            </h2>
                            <div className="field-grid archive-metric-grid">
                              {[
                                ['old', '老年人口占比', '%'],
                                ['livingAlone', '独居或空巢老人', '人'],
                                ['mobilityLimited', '行动受限老人', '人'],
                                ['oldest', '最高年龄', '岁'],
                              ].map(([key, label, unit]) => (
                                <label className="field" key={key}>
                                  {label}
                                  <div className="input-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      max={key === 'old' ? 100 : undefined}
                                      value={project.fields[key] || ''}
                                      placeholder="待补充"
                                      onChange={(event) =>
                                        update((p) => ({
                                          ...p,
                                          fields: {
                                            ...p.fields,
                                            [key]: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                    <span>{unit}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                            <div className="archive-text-grid archive-summary-grid">
                              {[
                                [
                                  'elderProfiles',
                                  '重点老人画像',
                                  '年龄、居住情况、行动能力、辅助器具与照护条件…',
                                ],
                                [
                                  'elderBehaviors',
                                  '日常行为与活动路线',
                                  '记录何时出门、去哪里、在哪里停顿、绕行或求助…',
                                ],
                                [
                                  'elderNeeds',
                                  '已知需求与风险',
                                  '通行、休息、识路、如厕、照明与求助需求…',
                                ],
                                [
                                  'mobilityConstraints',
                                  '行动特点与限制',
                                  '步速、连续步行距离及对高差与湿滑路面的敏感情况…',
                                ],
                              ].map(([key, label, placeholder]) => (
                                <label className="field" key={key}>
                                  {label}
                                  <textarea
                                    value={project.fields[key] || ''}
                                    placeholder={placeholder}
                                    onChange={(event) =>
                                      update((p) => ({
                                        ...p,
                                        fields: {
                                          ...p.fields,
                                          [key]: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </section>
                          <section className="form-section">
                            <h2>
                              <Route />
                              空间条件与建设边界<span>方案生成依据</span>
                            </h2>
                            <div className="archive-text-grid archive-summary-grid">
                              {[
                                [
                                  'roads',
                                  '道路与通行条件',
                                  '路宽、坡度、高差、路面、排水、照明与交通冲突…',
                                ],
                                [
                                  'residential',
                                  '居住点与公共设施',
                                  '老人居住分布、设施位置、开放时段与服务半径…',
                                ],
                                [
                                  'priorityAreas',
                                  '重点区域与建设对象',
                                  '明确优先路径、节点、设施或人群…',
                                ],
                                [
                                  'constraints',
                                  '建设约束',
                                  '权属、风貌、消防、施工、运营与维护限制…',
                                ],
                                [
                                  'cases',
                                  '已有案例与资料',
                                  '资料名称、来源、地区、适用条件和证据等级…',
                                ],
                                [
                                  'userRequirements',
                                  '实施主体要求',
                                  '必须满足、希望实现与不能接受的条件…',
                                ],
                                [
                                  'designGoals',
                                  '适老化设计目标',
                                  '围绕安全、独立使用、识路、停留、社交和求助定义目标…',
                                ],
                                [
                                  'openQuestions',
                                  '待核实问题',
                                  '记录需要现场、专业人员或用户进一步确认的内容…',
                                ],
                              ].map(([key, label, placeholder]) => (
                                <label className="field" key={key}>
                                  {label}
                                  <textarea
                                    value={project.fields[key] || ''}
                                    placeholder={placeholder}
                                    onChange={(event) =>
                                      update((p) => ({
                                        ...p,
                                        fields: {
                                          ...p.fields,
                                          [key]: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </section>
                          <button
                            className="next-step"
                            onClick={() => setTab('photos')}
                          >
                            下一步，整理图片库
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      ) : (
                        <div className="gallery">
                          <div className="search">
                            <Search size={18} />
                            <input
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder="搜索图片名称或分类…"
                            />
                          </div>
                          <div className="upload-grid">
                            {photoCategories.map(
                              ({ title, sub, Icon, preview, tone }, index) => (
                                <div
                                  className={`upload-card ${tone}`}
                                  key={title}
                                >
                                  <div className="upload-card-top">
                                    <Icon />
                                    <span>
                                      {String(index + 1).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <h3>{title}</h3>
                                  <p>{sub}</p>
                                  <div className="upload-preview">
                                    {/* oxlint-disable-next-line next/no-img-element -- Local generated gallery artwork is rendered at a responsive card crop. */}
                                    <img src={preview} alt={`${title}示意图`} />
                                  </div>
                                  <button
                                    onClick={() => {
                                      setCategory(title);
                                      file.current?.click();
                                    }}
                                  >
                                    <Upload size={17} />
                                    上传图片
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {page === 'debug' && (
                    <>
                      <div className="work-heading">
                        <div className="heading-icon">
                          <Play />
                        </div>
                        <div>
                          <div className="eyebrow">
                            TEST REAL USE, REFINE THE JUDGEMENT
                          </div>
                          <h1>适老化场景调试台</h1>
                          <p>
                            从真实资料出发，定义空间问题和老人行为，再逐步接入
                            3D 与 AI NPC 仿真。
                          </p>
                        </div>
                        <span className="pill prototype-pill">
                          <Clock size={12} /> 交互原型 · 分阶段实现
                        </span>
                      </div>
                      <Tabs
                        value={debugTab}
                        onValueChange={(value) => setDebugTab(String(value))}
                      >
                        <div className="tabs-row debug-tabs-row">
                          <TabsList className="village-tabs debug-tabs">
                            <TabsTrigger value="map">空间问题</TabsTrigger>
                            <TabsTrigger value="scene">3D 场景阶段</TabsTrigger>
                            <TabsTrigger value="behavior">
                              老人行为脚本
                            </TabsTrigger>
                            <TabsTrigger value="runs">
                              调试任务
                              <span className="mini-count">
                                {project.debugRuns.length}
                              </span>
                            </TabsTrigger>
                          </TabsList>
                          <span className="section-hint">
                            {debugTab === 'map'
                              ? '01 / 发现问题'
                              : debugTab === 'scene'
                                ? '02 / 搭建场景'
                                : debugTab === 'behavior'
                                  ? '03 / 定义行为'
                                  : '04 / 留下判断'}
                          </span>
                        </div>
                      </Tabs>
                      {debugTab === 'map' ? (
                        satellite ? (
                          <div className="survey-content">
                            <div className="map-toolbar">
                              <span>添加适老化问题</span>
                              {[
                                '通行障碍',
                                '休息缺口',
                                '识路困难',
                                '如厕问题',
                                '求助风险',
                                '公共设施',
                              ].map((kind) => (
                                <button
                                  className={markKind === kind ? 'active' : ''}
                                  onClick={() => setMarkKind(kind)}
                                  key={kind}
                                >
                                  {kind}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="map-canvas"
                              aria-label="空间问题标记地图；点击或按回车键可添加标记"
                              onClick={(event) => {
                                if (
                                  event.target instanceof Element &&
                                  event.target.closest('.map-pin')
                                ) {
                                  return;
                                }
                                if (event.detail === 0) {
                                  addMapMark(50, 50);
                                  return;
                                }
                                const rect =
                                  event.currentTarget.getBoundingClientRect();
                                addMapMark(
                                  ((event.clientX - rect.left) / rect.width) *
                                    100,
                                  ((event.clientY - rect.top) / rect.height) *
                                    100,
                                );
                              }}
                            >
                              {/* oxlint-disable-next-line next/no-img-element -- Runtime user uploads have no stable dimensions or remote loader. */}
                              <img
                                src={satellite.src}
                                alt="村庄卫星图，点击图像可添加适老化问题标记"
                              />
                              {project.marks.map((mark, index) => (
                                <span
                                  key={mark.id}
                                  title={mark.label}
                                  aria-hidden="true"
                                  style={{
                                    left: `${mark.x}%`,
                                    top: `${mark.y}%`,
                                  }}
                                  className="map-pin"
                                >
                                  {index + 1}
                                </span>
                              ))}
                              <span className="map-instruction">
                                <MapPin size={14} />
                                点击图像，添加问题点位
                              </span>
                            </button>
                            <div className="gallery-heading">
                              <h3>
                                空间问题记录 <span>{project.marks.length}</span>
                              </h3>
                              <button
                                onClick={() => {
                                  navigate('archive');
                                  setTab('photos');
                                }}
                              >
                                更换底图
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                            {project.marks.length ? (
                              <div className="mark-list detailed-marks">
                                {project.marks.map((mark, index) => (
                                  <div className="mark-record" key={mark.id}>
                                    <span className="mark-number">
                                      {index + 1}
                                    </span>
                                    <div className="mark-fields">
                                      <input
                                        aria-label="问题名称"
                                        value={mark.label}
                                        onChange={(event) =>
                                          update((p) => ({
                                            ...p,
                                            marks: p.marks.map((item) =>
                                              item.id === mark.id
                                                ? {
                                                    ...item,
                                                    label: event.target.value,
                                                  }
                                                : item,
                                            ),
                                          }))
                                        }
                                      />
                                      <textarea
                                        aria-label="现场观察与老人使用影响"
                                        value={mark.observation || ''}
                                        placeholder="补充现场证据、老人使用过程与影响…"
                                        onChange={(event) =>
                                          update((p) => ({
                                            ...p,
                                            marks: p.marks.map((item) =>
                                              item.id === mark.id
                                                ? {
                                                    ...item,
                                                    observation:
                                                      event.target.value,
                                                  }
                                                : item,
                                            ),
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="mark-meta">
                                      <span className="pill">{mark.kind}</span>
                                      <button
                                        className={`mark-status ${mark.status === '已确认' ? 'confirmed' : ''}`}
                                        onClick={() =>
                                          update((p) => ({
                                            ...p,
                                            marks: p.marks.map((item) =>
                                              item.id === mark.id
                                                ? {
                                                    ...item,
                                                    status:
                                                      item.status === '已确认'
                                                        ? '待核实'
                                                        : '已确认',
                                                  }
                                                : item,
                                            ),
                                          }))
                                        }
                                      >
                                        {mark.status || '待核实'}
                                      </button>
                                      <button
                                        aria-label="删除问题标记"
                                        onClick={() =>
                                          update((p) => ({
                                            ...p,
                                            marks: p.marks.filter(
                                              (item) => item.id !== mark.id,
                                            ),
                                          }))
                                        }
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="gallery-empty compact-empty">
                                <MapPin />
                                <p>在底图上标出老人真实使用过程中的问题。</p>
                                <span>
                                  每个问题都应补充现场证据并标记是否已确认
                                </span>
                              </div>
                            )}
                            <button
                              className="next-step"
                              onClick={() => setDebugTab('scene')}
                            >
                              查看 3D 场景实现阶段
                              <ArrowRight size={17} />
                            </button>
                          </div>
                        ) : (
                          <div className="survey-empty">
                            <div className="upload-orbit">
                              <Satellite />
                              <span>
                                <Upload />
                              </span>
                            </div>
                            <div className="eyebrow">
                              REAL EVIDENCE BEFORE SIMULATION
                            </div>
                            <h2>先补充村庄卫星图与现场资料</h2>
                            <p>
                              调试从真实空间和真实使用行为开始。
                              <br />
                              上传资料后，可标出通行、休息、识路、如厕和求助问题。
                            </p>
                            <button
                              className="primary-button"
                              onClick={() => {
                                setTab('photos');
                                navigate('archive');
                              }}
                            >
                              <Upload size={18} />
                              前往空间资料
                            </button>
                            <div className="empty-bottom debug-flow">
                              <span>01 整理资料</span>
                              <ArrowRight />
                              <span>02 标记问题</span>
                              <ArrowRight />
                              <span>03 定义行为</span>
                              <ArrowRight />
                              <span>04 形成判断</span>
                            </div>
                          </div>
                        )
                      ) : debugTab === 'scene' ? (
                        <div className="debug-stage-page">
                          <div className="boundary-note compact">
                            <AlertTriangle />
                            <p>
                              此处展示 3D 与 AI NPC
                              的分阶段产品流程，不把尚未接入的能力描述为已完成。当前可整理输入、问题点位和行为脚本。
                            </p>
                          </div>
                          <div className="stage-grid">
                            {[
                              {
                                index: '01',
                                title: '场景资料整理',
                                text: `已收集 ${project.photos.length} 份影像与现场资料`,
                                state: '当前可用',
                                Icon: ImageIcon,
                              },
                              {
                                index: '02',
                                title: '空间问题建档',
                                text: `已记录 ${project.marks.length} 个问题点位`,
                                state: '当前可用',
                                Icon: MapPin,
                              },
                              {
                                index: '03',
                                title: '可编辑 3D 场景',
                                text: '搭建道路、建筑、设施、地形和关键节点',
                                state: '待接入',
                                Icon: Box,
                              },
                              {
                                index: '04',
                                title: 'AI NPC 行为仿真',
                                text: '模拟老人行走、停顿、绕行、休息、识路、如厕和求助',
                                state: '待接入',
                                Icon: Users,
                              },
                            ].map(({ index, title, text, state, Icon }) => (
                              <article
                                className={`stage-card ${state === '待接入' ? 'future' : ''}`}
                                key={index}
                              >
                                <span className="stage-index">{index}</span>
                                <Icon />
                                <h3>{title}</h3>
                                <p>{text}</p>
                                <span className="stage-state">{state}</span>
                              </article>
                            ))}
                          </div>
                          <section className="form-section scene-input-summary">
                            <h2>
                              <Layers />
                              当前可交付给 3D 阶段的输入<span>INPUT CHECK</span>
                            </h2>
                            <div className="input-summary-grid">
                              <div>
                                <b>{satellite ? '已提供' : '待补充'}</b>
                                <span>卫星底图</span>
                              </div>
                              <div>
                                <b>{project.photos.length}</b>
                                <span>场景影像</span>
                              </div>
                              <div>
                                <b>{project.marks.length}</b>
                                <span>问题节点</span>
                              </div>
                              <div>
                                <b>{project.debugScenarios.length}</b>
                                <span>行为场景</span>
                              </div>
                            </div>
                          </section>
                          <button
                            className="next-step"
                            onClick={() => setDebugTab('behavior')}
                          >
                            定义老人行为脚本
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      ) : debugTab === 'behavior' ? (
                        <div className="form-scroll behavior-editor">
                          <section className="form-section">
                            <h2>
                              <Users />
                              测试人物与使用目标<span>PERSONA & GOAL</span>
                            </h2>
                            {[
                              [
                                'elderPersona',
                                '重点老人画像',
                                '描述年龄、行动能力、辅助器具、认知与照护条件…',
                              ],
                              [
                                'mobilityConstraints',
                                '行动与感知限制',
                                '描述步速、耐力、视听、方向判断及对高差、湿滑的敏感性…',
                              ],
                              [
                                'testGoal',
                                '本轮调试目标',
                                '明确要检验的路径、设施、假设或改造效果…',
                              ],
                            ].map(([key, label, placeholder]) => (
                              <label className="field full" key={key}>
                                {label}
                                <textarea
                                  value={project.fields[key] || ''}
                                  placeholder={placeholder}
                                  onChange={(event) =>
                                    update((p) => ({
                                      ...p,
                                      fields: {
                                        ...p.fields,
                                        [key]: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                            ))}
                          </section>
                          <section className="form-section">
                            <h2>
                              <Play />
                              老人使用行为<span>可多选</span>
                            </h2>
                            <div className="scenario-grid">
                              {behaviorScenarios.map((scenario) => (
                                <label
                                  className={
                                    project.debugScenarios.includes(scenario)
                                      ? 'checked'
                                      : ''
                                  }
                                  key={scenario}
                                >
                                  <Checkbox
                                    checked={project.debugScenarios.includes(
                                      scenario,
                                    )}
                                    onCheckedChange={(checked) =>
                                      toggleScenario(scenario, Boolean(checked))
                                    }
                                  />
                                  <span>{scenario}</span>
                                  <small>
                                    {
                                      {
                                        行走: '路线连续与安全',
                                        停顿: '犹豫、观察与等待',
                                        绕行: '障碍与路径选择',
                                        休息: '距离、座椅与遮阴',
                                        识路: '地标、标识与照明',
                                        如厕: '可达、开放与使用',
                                        求助: '可见、可达与响应',
                                      }[scenario]
                                    }
                                  </small>
                                </label>
                              ))}
                            </div>
                          </section>
                          <div className="debug-action-row">
                            <div>
                              <AlertTriangle />
                              <span>
                                保存的是调试任务定义，不会生成虚假的 3D 或 NPC
                                结果。
                              </span>
                            </div>
                            <button
                              className="primary-button"
                              onClick={createDebugRun}
                              disabled={!project.debugScenarios.length}
                            >
                              <Play size={17} />
                              保存行为调试任务
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="debug-runs">
                          <div className="boundary-note compact">
                            <ShieldCheck />
                            <p>
                              调试任务用于串联输入、行为和后续结果。当前只记录准备状态；真实仿真结果接入后，才能据此形成问题诊断。
                            </p>
                          </div>
                          {project.debugRuns.length ? (
                            <div className="debug-run-list">
                              {project.debugRuns.map((run) => (
                                <article
                                  className="debug-run-card"
                                  key={run.id}
                                >
                                  <div className="debug-run-top">
                                    <span className="pill">{run.status}</span>
                                    <small>
                                      {new Date(run.created).toLocaleDateString(
                                        'zh-CN',
                                      )}
                                    </small>
                                  </div>
                                  <h3>{run.title}</h3>
                                  <p>{run.note}</p>
                                  <div className="run-scenarios">
                                    {run.scenarios.map((scenario) => (
                                      <span key={scenario}>{scenario}</span>
                                    ))}
                                  </div>
                                  <div className="debug-run-actions">
                                    <button
                                      onClick={() =>
                                        update((p) => ({
                                          ...p,
                                          debugRuns: p.debugRuns.map((item) =>
                                            item.id === run.id
                                              ? {
                                                  ...item,
                                                  status:
                                                    item.status === '待建模'
                                                      ? '资料准备中'
                                                      : '待专业复核',
                                                }
                                              : item,
                                          ),
                                        }))
                                      }
                                    >
                                      更新准备状态
                                    </button>
                                    <button
                                      aria-label={`删除 ${run.title}`}
                                      onClick={() =>
                                        update((p) => ({
                                          ...p,
                                          debugRuns: p.debugRuns.filter(
                                            (item) => item.id !== run.id,
                                          ),
                                        }))
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="survey-empty compact-run-empty">
                              <Play size={42} />
                              <h2>还没有调试任务</h2>
                              <p>先定义重点老人、使用目标与行为场景。</p>
                              <button
                                className="primary-button"
                                onClick={() => setDebugTab('behavior')}
                              >
                                定义行为脚本
                              </button>
                            </div>
                          )}
                          <button
                            className="next-step"
                            onClick={() => navigate('plans')}
                          >
                            将已确认资料带入方案
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {page === 'plans' && (
                    <div className="notebook">
                      <div className="plan-list glass">
                        <div className="plan-list-top">
                          <span>
                            方案库 <small>{project.plans.length}</small>
                          </span>
                          <div className="plan-list-actions">
                            <button
                              className={comparing ? 'active' : ''}
                              aria-label={
                                comparing ? '退出方案比较' : '比较方案'
                              }
                              onClick={() => {
                                setComparing((value) => !value);
                                setEditing(false);
                                if (compareIds.length < 2) {
                                  setCompareIds(
                                    project.plans
                                      .slice(0, 2)
                                      .map((item) => item.id),
                                  );
                                }
                              }}
                            >
                              <GitCompare size={17} />
                            </button>
                            <button
                              aria-label="新建方案"
                              onClick={() => {
                                setDialog('plan');
                                setName('');
                              }}
                            >
                              <Plus size={19} />
                            </button>
                          </div>
                        </div>
                        {comparing && (
                          <p className="compare-hint">
                            选择两版方案进行取舍比较
                          </p>
                        )}
                        {project.plans.map((item, index) => (
                          <button
                            key={item.id}
                            aria-label={`${comparing ? '选择比较' : '打开'}方案：${item.title}`}
                            onClick={() => {
                              if (comparing) {
                                toggleComparePlan(item.id);
                                return;
                              }
                              setSelectedPlan(item.id);
                              setEditing(false);
                            }}
                            className={`plan-card ${!comparing && plan?.id === item.id ? 'active' : ''} ${comparing && compareIds.includes(item.id) ? 'compare-selected' : ''}`}
                          >
                            <div className={`plan-thumb thumb-${index % 3}`} />
                            <div>
                              <h3>{item.title}</h3>
                              <small>
                                {item.id === project.current
                                  ? '当前方案'
                                  : comparing && compareIds.includes(item.id)
                                    ? '已加入比较'
                                    : '方案草稿'}
                              </small>
                              <span>适老化 · 有依据 · 待复核</span>
                            </div>
                          </button>
                        ))}
                        <button
                          className="new-plan"
                          onClick={() => {
                            setDialog('plan');
                            setName('');
                          }}
                        >
                          <Plus size={16} />
                          新建方案
                        </button>
                        <div className="plan-list-note">
                          具体到场景，
                          <br />
                          追溯到依据。
                          <Leaf />
                        </div>
                      </div>
                      <article className="paper">
                        {comparing ? (
                          <div className="comparison-paper">
                            <div className="paper-toolbar">
                              <span className="eyebrow">
                                COMPARE THE TRADE-OFFS
                              </span>
                              <span className="pill">
                                <GitCompare size={13} />{' '}
                                {comparisonPlans.length} / 2
                              </span>
                            </div>
                            <div className="paper-title">
                              <span>方案比较 / DECISION SUPPORT</span>
                              <h1>把取舍说清楚，再确认方向</h1>
                              <p>
                                比较问题场景、价值、实施成本、维护与待复核事项
                              </p>
                            </div>
                            {comparisonPlans.length === 2 ? (
                              <div className="compare-grid">
                                {comparisonPlans.map((item) => (
                                  <section
                                    className="compare-column"
                                    key={item.id}
                                  >
                                    <div className="compare-column-head">
                                      <span
                                        className={
                                          item.id === project.current
                                            ? 'pill current'
                                            : 'pill'
                                        }
                                      >
                                        {item.id === project.current
                                          ? '当前方案'
                                          : '备选方案'}
                                      </span>
                                      <h2>{item.title}</h2>
                                    </div>
                                    {[
                                      [
                                        '问题与场景',
                                        `${item.body}\n${item.scene || ''}`,
                                      ],
                                      [
                                        '创新与价值',
                                        item.innovation || '待补充',
                                      ],
                                      [
                                        '实施与成本',
                                        `${item.implementation || '待补充'}\n${item.cost || '成本待估算'}`,
                                      ],
                                      [
                                        '维护要求',
                                        item.maintenance || '待明确',
                                      ],
                                      ['方案取舍', item.tradeoffs || '待比较'],
                                      [
                                        '待核实事项',
                                        item.verification || '待补充',
                                      ],
                                    ].map(([label, value]) => (
                                      <div className="compare-item" key={label}>
                                        <b>{label}</b>
                                        <p>{value}</p>
                                      </div>
                                    ))}
                                    <button
                                      className="compare-set-current"
                                      onClick={() => {
                                        update((p) => ({
                                          ...p,
                                          current: item.id,
                                        }));
                                        setNotice('已更新当前方案');
                                      }}
                                    >
                                      <CheckCircle2 size={15} />
                                      设为当前方案
                                    </button>
                                  </section>
                                ))}
                              </div>
                            ) : (
                              <div className="survey-empty compact-run-empty">
                                <GitCompare size={42} />
                                <h2>请选择两版方案</h2>
                                <p>在左侧点击方案卡片加入或移出比较。</p>
                              </div>
                            )}
                            <div className="boundary-note compact">
                              <AlertTriangle />
                              <p>
                                比较结果用于辅助讨论。涉及规范、工程安全、造价和审批的内容仍需专业复核。
                              </p>
                            </div>
                          </div>
                        ) : plan ? (
                          <>
                            <div className="paper-toolbar">
                              <span className="eyebrow">
                                TRACEABLE AGE-FRIENDLY PLAN
                              </span>
                              <button
                                className="pill"
                                onClick={() => {
                                  update((p) => ({ ...p, current: plan.id }));
                                  setNotice('已设为当前方案');
                                }}
                              >
                                <CheckCircle2 size={13} />
                                {project.current === plan.id
                                  ? '当前方案'
                                  : '设为当前'}
                              </button>
                              <button
                                className="icon-button"
                                aria-label="导出方案"
                                onClick={download}
                              >
                                <Download size={17} />
                              </button>
                            </div>
                            <div className="paper-title">
                              <span>乡村适老化建设方案 / PLANNING</span>
                              {editing ? (
                                <input
                                  aria-label="方案标题"
                                  value={plan.title}
                                  onChange={(event) =>
                                    updatePlanField('title', event.target.value)
                                  }
                                />
                              ) : (
                                <h1>{plan.title}</h1>
                              )}
                              <p>
                                最近编辑 ·{' '}
                                {new Date(project.updated).toLocaleDateString(
                                  'zh-CN',
                                )}
                                <span>张工</span>
                              </p>
                              <div className="tags">
                                <span>适老化</span>
                                <span>合规优先</span>
                                <span>场景化</span>
                                <span>可落地</span>
                              </div>
                            </div>
                            <div className="trace-grid">
                              <div>
                                <b>{project.address ? '已关联' : '待补充'}</b>
                                <span>村庄档案</span>
                              </div>
                              <div>
                                <b>
                                  {
                                    project.marks.filter(
                                      (mark) => mark.status === '已确认',
                                    ).length
                                  }
                                  /{project.marks.length}
                                </b>
                                <span>已确认问题</span>
                              </div>
                              <div>
                                <b>{plan.references ? '已记录' : '待补充'}</b>
                                <span>知识依据</span>
                              </div>
                              <div>
                                <b>{plan.verification ? '已列出' : '待补充'}</b>
                                <span>复核事项</span>
                              </div>
                            </div>
                            <section className="paper-section">
                              <h2>
                                <b>一</b>问题依据与老人使用场景
                              </h2>
                              {renderPlanField('body', '问题依据')}
                              <h3 className="paper-subtitle">
                                受影响的老人使用场景
                              </h3>
                              {renderPlanField('scene', '老人使用场景')}
                              <blockquote>
                                每个判断都应对应具体村庄、具体空间和具体老人使用过程。
                              </blockquote>
                            </section>
                            <section className="paper-section">
                              <h2>
                                <b>二</b>适用空间与建设对象
                              </h2>
                              {renderPlanField('scope', '适用空间与建设对象')}
                              {project.marks.length > 0 && (
                                <p className="linked-marks">
                                  关联调试问题：
                                  {project.marks
                                    .map((mark) => mark.label)
                                    .join('、')}
                                </p>
                              )}
                            </section>
                            <section className="paper-section">
                              <h2>
                                <b>三</b>案例、规范与研究关联
                              </h2>
                              {renderPlanField(
                                'references',
                                '知识来源、适用地区、适用条件与证据等级',
                              )}
                            </section>
                            <section className="paper-section">
                              <h2>
                                <b>四</b>创新点及其具体价值
                              </h2>
                              {renderPlanField(
                                'innovation',
                                '创新点与具体价值',
                              )}
                            </section>
                            <section className="paper-section">
                              <h2>
                                <b>五</b>合规、实施、成本与维护
                              </h2>
                              <div className="plan-detail-grid">
                                {[
                                  ['compliance', '合规依据与责任边界'],
                                  ['implementation', '实施条件与施工影响'],
                                  ['cost', '成本等级与分期'],
                                  ['maintenance', '维护要求与责任主体'],
                                ].map(([field, label]) => (
                                  <div className="plan-detail" key={field}>
                                    <h3>{label}</h3>
                                    {renderPlanField(
                                      field as PlanTextField,
                                      label,
                                    )}
                                  </div>
                                ))}
                              </div>
                            </section>
                            <section className="paper-section">
                              <h2>
                                <b>六</b>方案取舍与待核实事项
                              </h2>
                              <h3 className="paper-subtitle">方案取舍</h3>
                              {renderPlanField(
                                'tradeoffs',
                                '方案优势、局限与取舍',
                              )}
                              <h3 className="paper-subtitle">
                                待现场或专业复核
                              </h3>
                              {renderPlanField(
                                'verification',
                                '现场、专业人员或用户需确认的事项',
                              )}
                            </section>
                            <section className="paper-section review-section">
                              <h2>
                                <b>七</b>复核清单
                              </h2>
                              <div className="todo-grid">
                                {[
                                  '现场尺度与使用路线已核实',
                                  '规范条文与专业判断已复核',
                                  '老人、村民和实施主体已确认',
                                  '成本、施工影响与维护责任已明确',
                                ].map((task) => (
                                  <label key={task}>
                                    <Checkbox
                                      checked={Boolean(
                                        plan.tasks?.includes(task),
                                      )}
                                      onCheckedChange={(checked) =>
                                        update((p) => ({
                                          ...p,
                                          plans: p.plans.map((item) =>
                                            item.id === plan.id
                                              ? {
                                                  ...item,
                                                  tasks: checked
                                                    ? [
                                                        ...(item.tasks || []),
                                                        task,
                                                      ]
                                                    : (item.tasks || []).filter(
                                                        (value) =>
                                                          value !== task,
                                                      ),
                                                }
                                              : item,
                                          ),
                                        }))
                                      }
                                    />
                                    {task}
                                  </label>
                                ))}
                              </div>
                            </section>
                            <div className="boundary-note compact plan-disclaimer">
                              <AlertTriangle />
                              <p>
                                AI
                                输出属于辅助建议，不能替代专业设计、审批、施工、监理、检测和验收。
                              </p>
                            </div>
                            <div className="paper-bottom">
                              <span>
                                <Leaf size={16} />
                                适老为主，合规为底。
                              </span>
                              <button onClick={() => setEditing(!editing)}>
                                {editing ? (
                                  <Check size={15} />
                                ) : (
                                  <FileText size={15} />
                                )}{' '}
                                {editing ? '完成编辑' : '编辑方案'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="survey-empty">
                            <FileText size={45} />
                            <h2>让想法，落成一份方案</h2>
                            <p>从档案、调试、知识依据和用户反馈开始。</p>
                            <button
                              className="primary-button"
                              onClick={() => {
                                setDialog('plan');
                                setName('');
                              }}
                            >
                              <Plus size={18} />
                              新建方案
                            </button>
                          </div>
                        )}
                      </article>
                    </div>
                  )}
                </section>
              )}
              {assistant && (
                <aside
                  className={`assistant glass ${page === 'workspace' ? 'assistant-expanded' : ''} ${draggingPanel ? 'drop-ready' : ''} ${dragOverAssistant ? 'drop-active' : ''}`}
                >
                  {draggingPanel && (
                    <button
                      type="button"
                      className="assistant-drop-target"
                      aria-label={`将${panelMeta.find((item) => item.id === draggingPanel)?.title || '当前'}板块附加到对话`}
                      onClick={() => attachToAssistant(draggingPanel)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'link';
                        setDragOverAssistant(true);
                      }}
                      onDragLeave={() => setDragOverAssistant(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        const value =
                          event.dataTransfer.getData('text/workspace-panel') ||
                          draggingPanel;
                        if (panelMeta.some((item) => item.id === value)) {
                          attachToAssistant(value as WorkspacePanel);
                        }
                        setDraggingPanel(null);
                      }}
                    >
                      <Link2 size={22} />
                      <span>松开，将板块附加为单一对话通道</span>
                    </button>
                  )}
                  <div className="assistant-header">
                    <div className="assistant-avatar">
                      <Leaf />
                    </div>
                    <div>
                      <h2>
                        适老化助手 <span className="status-dot" />
                      </h2>
                      <p>用档案、调试与知识依据协作判断</p>
                    </div>
                    <button
                      aria-label="收起助手"
                      onClick={() => setAssistant(false)}
                    >
                      <PanelRightClose size={18} />
                    </button>
                  </div>
                  <div className="assistant-context">
                    <span className="status-dot" />
                    正在协作 · {conversationTitle}通道
                    <button
                      className="knowledge-trigger"
                      onClick={() => setDialog('knowledge')}
                    >
                      <BookOpen size={12} /> 知识库
                    </button>
                  </div>
                  {attachedPanel ? (
                    <div className="assistant-channel">
                      <Link2 />
                      <span>
                        <b>{conversationTitle}已附加</b>
                        <small>当前对话只围绕此板块组织上下文</small>
                      </span>
                      <button
                        aria-label="解除板块附加"
                        onClick={() => {
                          setAttachedPanel(null);
                          setNotice('已恢复项目综合对话');
                        }}
                      >
                        <Unlink size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="assistant-drop-hint">
                      <GripVertical />
                      <span>
                        {dragOverAssistant
                          ? '松开以建立单一通道'
                          : '将左侧板块拖到这里，可建立单一通道对话'}
                      </span>
                    </div>
                  )}
                  <div className="chat-scroll">
                    <div className="assistant-welcome">
                      <div className="eyebrow">
                        A LITTLE HELP, A BETTER VILLAGE
                      </div>
                      <h3>
                        {conversationPanel === 'plans'
                          ? '让每一版方案，\n都说清依据与取舍。'
                          : conversationPanel === 'debug'
                            ? '模拟真实使用，\n再修正空间判断。'
                            : '从真实村庄与老人，\n建立项目底板。'}
                      </h3>
                      <p>
                        {conversationPanel === 'archive'
                          ? '整理村庄、老人需求、空间资料、建设约束和待核实问题，为调试与方案提供基础。'
                          : conversationPanel === 'debug'
                            ? '组织空间问题、重点老人和行为脚本；当前原型不把尚未接入的 3D 与 NPC 能力说成真实结果。'
                            : '汇总档案、调试、知识依据与反馈，形成可比较、可追溯并明确复核边界的方案。'}
                      </p>
                    </div>
                    {messages.length === 0 ? (
                      <div className="suggestions">
                        <span>从这些问题开始</span>
                        {(conversationPanel === 'archive'
                          ? [
                              '这份档案还缺哪些老人需求资料？',
                              '梳理需要现场核实的问题',
                              '哪些资料可作为后续调试输入？',
                            ]
                          : conversationPanel === 'debug'
                            ? [
                                '为高龄老人定义一条行为脚本',
                                '当前场景输入还缺什么？',
                                '哪些发现需要现场而不是 AI 判断？',
                              ]
                            : [
                                '检查当前方案是否可追溯',
                                '比较两版方案的价值与代价',
                                '列出合规与专业复核事项',
                              ]
                        ).map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => send(suggestion)}
                          >
                            <MessageCircle size={17} />
                            {suggestion}
                            <ArrowUpRight size={14} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="chat-messages">
                        {messages.map((m, i) => (
                          <div className={`message ${m.role}`} key={i}>
                            {m.role === 'assistant' && <Leaf size={17} />}
                            <div>
                              {m.context && (
                                <span className="message-context">
                                  {panelMeta.find(
                                    (item) => item.id === m.context,
                                  )?.title || '项目'}
                                </span>
                              )}
                              <p>{m.text}</p>
                            </div>
                          </div>
                        ))}
                        <div ref={end} />
                      </div>
                    )}
                  </div>
                  <div className="chat-compose">
                    <button
                      className="clear-chat"
                      onClick={() => setMessages([])}
                    >
                      新对话
                      <Plus size={14} />
                    </button>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send();
                      }}
                    >
                      <textarea
                        aria-label="向助手提问"
                        rows={2}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={`围绕${conversationTitle}提问、质疑或补充…`}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <button
                        type="submit"
                        aria-label="发送消息"
                        disabled={!message.trim()}
                      >
                        <Send size={19} />
                      </button>
                    </form>
                    <p>
                      <ShieldCheck size={12} />
                      原型协作 · 依据、尺寸与工程判断需复核
                    </p>
                  </div>
                </aside>
              )}
              {!assistant && (
                <button
                  className="assistant-rail"
                  onClick={() => setAssistant(true)}
                  aria-label="展开适老化助手"
                >
                  <Sparkles size={18} />
                  <span>对话</span>
                  {attachedPanel && <Link2 size={14} />}
                </button>
              )}
            </div>
          </main>
        </SidebarProvider>
      )}
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog('');
        }}
      >
        <DialogContent
          className={`village-dialog ${dialog === 'knowledge' ? 'knowledge-dialog' : ''}`}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === 'settings'
                ? '工作台设置'
                : dialog === 'knowledge'
                  ? '知识库结构与追溯要求'
                  : dialog === 'project'
                    ? '为村庄，新建一份档案'
                    : '把新的想法，写成方案'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'settings'
                ? '资料保存在当前浏览器，可导出作为备份。'
                : dialog === 'knowledge'
                  ? '知识库贯穿档案、调试、对话与方案；当前展示规划结构，不虚构具体来源。'
                  : '一个清晰的名字，是美好改变的开始。'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'settings' ? (
            <>
              <div className="setting-row">
                <span>资料存储</span>
                <b>{saved}</b>
              </div>
              <div className="setting-row">
                <span>当前项目</span>
                <b>{project.name}</b>
              </div>
              <div className="setting-row">
                <span>项目总纲</span>
                <b>已备份至项目 docs 目录</b>
              </div>
              <button className="primary-button" onClick={download}>
                <Download size={17} />
                导出当前项目资料
              </button>
            </>
          ) : dialog === 'knowledge' ? (
            <div className="knowledge-dialog-content">
              <div className="knowledge-layer-list">
                {knowledgeLayers.map((layer, index) => (
                  <article key={layer.title}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{layer.title}</h3>
                      <p>{layer.purpose}</p>
                      <small>{layer.trace}</small>
                    </div>
                  </article>
                ))}
              </div>
              <div className="boundary-note compact">
                <ShieldCheck />
                <p>
                  每条知识需保留来源、适用地区、适用条件、证据等级和可迁移范围。涉及规范与工程安全的判断必须再次专业复核。
                </p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <label className="field">
                {dialog === 'project' ? '项目名称' : '方案名称'}
                <input
                  className="plain-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    dialog === 'project'
                      ? '例如：青溪村 · 适老化建设计划'
                      : '例如：连续慢行与休憩网络 · 方案 A'
                  }
                  maxLength={60}
                />
              </label>
              <button
                className="primary-button"
                disabled={!name.trim()}
                type="submit"
              >
                <Plus size={17} />
                确认创建
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {notice && (
        <output className="toast">
          <CheckCircle2 size={18} />
          {notice}
        </output>
      )}
    </div>
  );
}
