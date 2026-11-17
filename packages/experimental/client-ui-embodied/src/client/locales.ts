/** Embodied Harness workbench product copy. */
export const en = {
  selfTitle: 'Robot self', selfIntro: 'Discover the connected robot and plan tasks or development from its actual capabilities.',
  agentEntry: 'Work through the Harness conversation', agentInstructions: 'Ask: “What can this robot do?”, “Read its current position”, or “Develop a capability it is missing”. The Agent receives the current inventory and uses the same robot tools.',
  discoveryScope: 'Discovery is limited to configured adapters and visible interfaces. Detected services do not imply executable motion or complete hardware coverage.',
  scanning: 'Discovering devices and services…', rescan: 'Refresh discovery', lastScan: 'Received at', snapshotNotice: 'Observation snapshot; refresh before relying on device state.',
  noRobot: 'No robot adapter is configured. Select a supported adapter and its endpoint in the profile.', selfError: 'Robot discovery failed. Check the adapter configuration and connection, then refresh.',
  connectionFailed: 'Robot discovery unavailable', connectionRecovery: 'Check network access and the configured gateway. No simulated capabilities are substituted.',
  readable: 'Observation ready', limited: 'Limited / adapter needed', unavailable: 'Unavailable', callable: 'Registered operations', noAdapter: 'No callable operation is registered. Implement and validate an adapter before using this capability.',
  observe: 'Read-only', act: 'Physical action', deviceEvidence: 'Source and observed facts',
  title: 'Robot development', intro: 'Describe a goal, choose a starter, and inspect sample evidence before connecting hardware.',
  sampleOnly: 'Sample environment · No physical robot connected', refresh: 'Refresh projects', empty: 'No projects yet. Create your first project below.',
  name: 'Project name', goal: 'What should the robot do?', create: 'Create project', vision: 'Visual recognition', memory: 'Spatial memory',
  full: 'Sample camera and localization', camera: 'Sample camera only', template: 'Starter template', target: 'Target device',
  selected: 'Project overview', run: 'Run sample', query: 'Object description, e.g. cup or keys', change: 'Apply selected target and provider versions',
  export: 'Export project JSON', revision: 'Revision', workflow: 'Capability workflow', evidence: 'Validation evidence',
  stale: 'Needs validation for the current configuration', passed: 'Sample passed', blocked: 'Sample checks failed',
  limitations: 'Samples use annotated labels, not image inference. Historical observer positions are not current object coordinates. Real robot adapters, simulation physics and deployment are not included.',
  noPosition: 'Observer position unavailable', position: 'Observer position', historical: 'Historical sample',
  error: 'The operation could not be confirmed. Refresh the project before retrying.', busy: 'Working…', old: 'Previous revision evidence',
  image: 'Read image', detect: 'Read annotated objects', record: 'Record observation', search: 'Search labels', report: 'Inspect report',
  copy: 'Copy the JSON below to preserve this project and its evidence.', hardware: 'Real hardware: adapter and capability validation required',
} as const
/** Workbench translation keys shared by both locale dictionaries. */
export type StudioKey = keyof typeof en
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { robotStudio: StudioKey } }
/** Chinese workbench labels and recovery guidance. */
export const zh: Record<StudioKey, string> = {
  selfTitle: '机器人自身', selfIntro: '感知当前连接的机器人，根据真实能力执行任务或进行开发。',
  agentEntry: '在 Harness 对话中执行任务与开发', agentInstructions: '直接问：“你现在有哪些能力？”“读取当前定位”“帮我开发缺少的功能”。Agent 会读取当前能力清单，并通过同一组机器人工具操作。',
  discoveryScope: '发现范围取决于已配置的适配器与可见接口。检测到服务，不代表已支持运动执行，也不代表已覆盖所有硬件。',
  scanning: '正在探测设备与服务…', rescan: '重新发现', lastScan: '本次读取时间', snapshotNotice: '这是观测快照，使用设备状态前需要刷新。',
  noRobot: '尚未配置机器人适配器，请在配置档中指定适配器与连接地址。', selfError: '机器人发现失败，请检查适配器配置和连接后重新发现。',
  connectionFailed: '机器人发现不可用', connectionRecovery: '请检查网络与网关地址。系统不会用模拟能力替代连接失败。',
  readable: '状态可读取', limited: '受限 / 待适配', unavailable: '不可用', callable: '已注册操作', noAdapter: '当前没有可调用操作，需要先开发并验证适配器。',
  observe: '只读', act: '物理动作', deviceEvidence: '来源与观测事实',
  title: '机器人开发', intro: '描述目标、选择模板，先查看样例验证结果，再逐步连接硬件。',
  sampleOnly: '样例环境 · 未连接真实机器人', refresh: '刷新项目', empty: '还没有项目，从下方创建第一个项目。',
  name: '项目名称', goal: '你想让机器人做什么？', create: '创建项目', vision: '视觉识别', memory: '空间记忆',
  full: '样例：相机与定位', camera: '样例：仅相机', template: '开发模板', target: '目标设备',
  selected: '项目概览', run: '运行样例', query: '物体描述，例如：杯子、钥匙、本子', change: '应用所选设备及插件版本',
  export: '导出项目 JSON', revision: '版本', workflow: '能力流程', evidence: '验证证据',
  stale: '当前配置需要重新验证', passed: '样例通过', blocked: '样例检查未通过',
  limitations: '样例使用已有标签，不执行图像模型推理。历史观察位置不是物品的当前位置。本版不包含真实机型适配、物理仿真和实机部署。',
  noPosition: '观察位置不可用', position: '观察位置', historical: '历史样例',
  error: '未能确认操作结果。请先刷新项目，再决定是否重试。', busy: '处理中…', old: '旧版本的验证证据',
  image: '读取画面', detect: '读取物体标注', record: '记录观察', search: '按标签检索', report: '查看报告',
  copy: '复制下面的 JSON 可保存项目及其验证证据。', hardware: '真实机器人：需要适配器及能力验证',
}
