/**
 * Aether Global State Store
 * Central Zustand store for all app state: connection, voice, goals, approvals, memory, settings
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Connection Status ────────────────────────────────────────────────────────
export const CONNECTION_STATUS = {
  IDLE: 'idle',
  SEARCHING: 'searching',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

// ─── Voice States ─────────────────────────────────────────────────────────────
export const VOICE_STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
};

// ─── Reasoning Node States ────────────────────────────────────────────────────
export const NODE_STATUS = {
  IDLE: 'idle',
  THINKING: 'thinking',
  COMPLETE: 'complete',
  WAITING: 'waiting',
  ERROR: 'error',
};

// ─── Main Store ───────────────────────────────────────────────────────────────
const useAetherStore = create(
  persist(
    (set, get) => ({
      // ── Connection ──────────────────────────────────────────────────────────
      connectionStatus: CONNECTION_STATUS.IDLE,
      connectedHost: null,
      lastConnectedAt: null,
      lastSeenAt: null,
      reconnectAttempts: 0,
      wsRef: null, // not persisted — runtime ref
      heartbeatInterval: null,

      // ── Activity ────────────────────────────────────────────────────────────
      currentActivity: null, // e.g. "Planning goal: Research quantum computing"
      tokenUsage: { input: 0, output: 0, total: 0 },
      memoryCount: 0,

      // ── Active Goal & Execution ─────────────────────────────────────────────
      activeGoal: null,
      isExecuting: false,
      executionPaused: false,
      executionNodes: [], // Array of { id, name, type, status, content, timestamp }
      executionLog: [],   // Raw streaming log lines

      // ── Pending Approvals ───────────────────────────────────────────────────
      pendingApprovals: [], // { id, toolName, action, reason, riskLevel, timestamp }
      approvalHistory: [],  // { id, toolName, outcome, reason, timestamp }

      // ── Voice ───────────────────────────────────────────────────────────────
      voiceState: VOICE_STATE.IDLE,
      voiceTranscript: [], // { role: 'user'|'aether', text, timestamp }
      isVoiceActive: false,

      // ── Memory ─────────────────────────────────────────────────────────────
      memories: [],          // cached from backend
      memoriesLoading: false,
      memoriesLastFetched: null,

      // ── Goals History ───────────────────────────────────────────────────────
      recentGoals: [], // last 20 goals with status

      // ── Settings (persisted) ────────────────────────────────────────────────
      settings: {
        // Connection
        savedHost: '',
        savedPort: '8765',
        autoConnect: true,
        // LLM
        selectedModel: 'llama3.1:8b',
        availableModels: [],
        // Memory
        importanceThreshold: 0.5,
        reflectionFrequency: 'daily',
        // Voice
        voiceSpeed: 1.0,
        voiceModel: 'alloy',
        micSensitivity: 0.7,
        // Theme
        theme: 'charcoal',
        // Notifications
        notificationsEnabled: false,
      },

      // ── Self-Improvement Log ────────────────────────────────────────────────
      improvementLog: [],

      // ── Onboarding ─────────────────────────────────────────────────────────
      onboardingComplete: false,

      // ═══════════════════════════════════════════════════════════════════════
      // Actions
      // ═══════════════════════════════════════════════════════════════════════

      // ── Connection Actions ──────────────────────────────────────────────────
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setConnected: (host) => set({
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        connectedHost: host,
        lastConnectedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        reconnectAttempts: 0,
      }),

      setDisconnected: () => set((state) => ({
        connectionStatus: CONNECTION_STATUS.DISCONNECTED,
        lastSeenAt: state.lastSeenAt || new Date().toISOString(),
      })),

      setWsRef: (ref) => set({ wsRef: ref }),

      incrementReconnectAttempts: () => set((state) => ({
        reconnectAttempts: state.reconnectAttempts + 1,
      })),

      updateHeartbeat: () => set({ lastSeenAt: new Date().toISOString() }),

      // ── Activity Actions ────────────────────────────────────────────────────
      setCurrentActivity: (activity) => set({ currentActivity: activity }),

      updateTokenUsage: (usage) => set((state) => ({
        tokenUsage: { ...state.tokenUsage, ...usage },
      })),

      updateMemoryCount: (count) => set({ memoryCount: count }),

      // ── Goal & Execution Actions ────────────────────────────────────────────
      submitGoal: (goalText) => {
        const goal = {
          id: `goal_${Date.now()}`,
          text: goalText,
          status: 'submitted',
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          activeGoal: goal,
          isExecuting: true,
          executionPaused: false,
          executionNodes: [],
          executionLog: [],
          recentGoals: [goal, ...state.recentGoals.slice(0, 19)],
        }));
        return goal;
      },

      addExecutionNode: (node) => set((state) => {
        const exists = state.executionNodes.find(n => n.id === node.id);
        if (exists) {
          return {
            executionNodes: state.executionNodes.map(n =>
              n.id === node.id ? { ...n, ...node } : n
            ),
          };
        }
        return { executionNodes: [...state.executionNodes, node] };
      }),

      updateExecutionNode: (id, updates) => set((state) => ({
        executionNodes: state.executionNodes.map(n =>
          n.id === id ? { ...n, ...updates } : n
        ),
      })),

      appendExecutionLog: (line) => set((state) => ({
        executionLog: [...state.executionLog.slice(-200), line],
      })),

      pauseExecution: () => set({ executionPaused: true }),
      resumeExecution: () => set({ executionPaused: false }),

      completeExecution: (result) => set((state) => ({
        isExecuting: false,
        executionPaused: false,
        activeGoal: state.activeGoal
          ? { ...state.activeGoal, status: 'complete', result, completedAt: new Date().toISOString() }
          : null,
      })),

      clearExecution: () => set({
        activeGoal: null,
        isExecuting: false,
        executionPaused: false,
        executionNodes: [],
        executionLog: [],
      }),

      // ── Approval Actions ────────────────────────────────────────────────────
      addPendingApproval: (approval) => set((state) => ({
        pendingApprovals: [...state.pendingApprovals, {
          ...approval,
          timestamp: new Date().toISOString(),
        }],
      })),

      resolveApproval: (id, outcome, reason = '') => set((state) => {
        const approval = state.pendingApprovals.find(a => a.id === id);
        if (!approval) return {};
        return {
          pendingApprovals: state.pendingApprovals.filter(a => a.id !== id),
          approvalHistory: [{
            ...approval,
            outcome,
            reason,
            resolvedAt: new Date().toISOString(),
          }, ...state.approvalHistory.slice(0, 49)],
        };
      }),

      // ── Voice Actions ───────────────────────────────────────────────────────
      setVoiceState: (voiceState) => set({ voiceState }),
      setVoiceActive: (isVoiceActive) => set({ isVoiceActive }),

      addVoiceTranscript: (entry) => set((state) => ({
        voiceTranscript: [...state.voiceTranscript.slice(-100), {
          ...entry,
          timestamp: new Date().toISOString(),
        }],
      })),

      clearVoiceTranscript: () => set({ voiceTranscript: [] }),

      // ── Memory Actions ──────────────────────────────────────────────────────
      setMemories: (memories) => set({
        memories,
        memoriesLoading: false,
        memoriesLastFetched: new Date().toISOString(),
      }),

      setMemoriesLoading: (loading) => set({ memoriesLoading: loading }),

      updateMemoryImportance: (id, importance) => set((state) => ({
        memories: state.memories.map(m => m.id === id ? { ...m, importance } : m),
      })),

      deleteMemory: (id) => set((state) => ({
        memories: state.memories.filter(m => m.id !== id),
      })),

      // ── Settings Actions ────────────────────────────────────────────────────
      updateSettings: (patch) => set((state) => ({
        settings: { ...state.settings, ...patch },
      })),

      setAvailableModels: (models) => set((state) => ({
        settings: { ...state.settings, availableModels: models },
      })),

      // ── Improvement Log ─────────────────────────────────────────────────────
      addImprovementEntry: (entry) => set((state) => ({
        improvementLog: [{
          ...entry,
          timestamp: new Date().toISOString(),
        }, ...state.improvementLog],
      })),

      // ── Onboarding ──────────────────────────────────────────────────────────
      completeOnboarding: () => set({ onboardingComplete: true }),

      // ── Demo / Mock data for preview ────────────────────────────────────────
      loadMockData: () => set({
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        connectedHost: '192.168.1.42:8765',
        lastConnectedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        currentActivity: 'Reflecting on recent sessions…',
        tokenUsage: { input: 142840, output: 38921, total: 181761 },
        memoryCount: 247,
        memories: MOCK_MEMORIES,
        pendingApprovals: MOCK_APPROVALS,
        recentGoals: MOCK_GOALS,
        improvementLog: MOCK_IMPROVEMENT_LOG,
        settings: {
          savedHost: '192.168.1.42',
          savedPort: '8765',
          autoConnect: true,
          selectedModel: 'llama3.1:8b',
          availableModels: ['llama3.1:8b', 'llama3.1:70b', 'mistral:7b', 'phi4:latest', 'qwen2.5:14b'],
          importanceThreshold: 0.5,
          reflectionFrequency: 'daily',
          voiceSpeed: 1.0,
          voiceModel: 'alloy',
          micSensitivity: 0.7,
          theme: 'charcoal',
          notificationsEnabled: true,
        },
        voiceTranscript: MOCK_TRANSCRIPT,
        onboardingComplete: true,
      }),
    }),

    {
      name: 'aether-store',
      // Only persist settings + onboarding state + history (not runtime WS state)
      partialize: (state) => ({
        settings: state.settings,
        onboardingComplete: state.onboardingComplete,
        recentGoals: state.recentGoals,
        approvalHistory: state.approvalHistory,
        improvementLog: state.improvementLog,
        connectedHost: state.connectedHost,
        lastSeenAt: state.lastSeenAt,
      }),
    }
  )
);

export default useAetherStore;

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_MEMORIES = [
  {
    id: 'm1',
    type: 'episodic',
    content: 'User asked me to research quantum computing advances in error correction. Found 3 significant papers from 2024 on topological qubits. Drafted a summary and saved to knowledge base.',
    importance: 0.87,
    relevance: 0.92,
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    tags: ['research', 'quantum', 'science'],
  },
  {
    id: 'm2',
    type: 'reflection',
    content: 'When breaking down complex multi-step goals, I perform better when I explicitly enumerate dependencies before starting execution. This reduces backtracking by approximately 40%.',
    importance: 0.94,
    relevance: 0.78,
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    tags: ['meta-cognition', 'planning', 'efficiency'],
  },
  {
    id: 'm3',
    type: 'lesson',
    content: 'File system tools should always check for existing files before writing to avoid data loss. Implemented a safety check in all file-writing procedures.',
    importance: 0.91,
    relevance: 0.65,
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    tags: ['safety', 'tools', 'file-system'],
  },
  {
    id: 'm4',
    type: 'episodic',
    content: 'Helped compile a comprehensive reading list on distributed systems for the user. Cross-referenced with their Obsidian notes to avoid duplicates. 23 books organized by difficulty tier.',
    importance: 0.72,
    relevance: 0.55,
    timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
    tags: ['books', 'distributed-systems', 'organization'],
  },
  {
    id: 'm5',
    type: 'lesson',
    content: 'When the user says "brief", they mean under 200 words. When they say "comprehensive", they want structured sections with examples. Calibrating communication style improves satisfaction scores.',
    importance: 0.88,
    relevance: 0.81,
    timestamp: new Date(Date.now() - 3600000 * 96).toISOString(),
    tags: ['communication', 'user-preference', 'style'],
  },
];

const MOCK_APPROVALS = [
  {
    id: 'a1',
    toolName: 'file_write',
    action: 'Write 847 bytes to /home/user/notes/research-summary.md',
    reason: 'Creating the research summary you requested for quantum computing findings. This is the final output artifact.',
    riskLevel: 'low',
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'a2',
    toolName: 'web_search',
    action: 'Execute Google Search: "topological qubit error rates 2025 arxiv"',
    reason: 'Need to verify recency of discovered papers. My training data may be outdated on this rapidly evolving topic.',
    riskLevel: 'low',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
];

const MOCK_GOALS = [
  { id: 'g1', text: 'Research and summarize latest advances in quantum error correction', status: 'complete', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'g2', text: 'Organize my reading list into a tiered learning path for distributed systems', status: 'complete', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'g3', text: 'Reflect on this week\'s sessions and extract key lessons', status: 'complete', createdAt: new Date(Date.now() - 172800000).toISOString() },
];

const MOCK_IMPROVEMENT_LOG = [
  { lesson: 'Adopted dependency-first planning strategy for complex multi-step goals', category: 'planning', confidence: 0.89, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { lesson: 'Calibrated verbosity to user communication style: default to concise unless structured output requested', category: 'communication', confidence: 0.94, timestamp: new Date(Date.now() - 172800000).toISOString() },
  { lesson: 'Implemented pre-write file existence checks across all file tool calls', category: 'safety', confidence: 0.97, timestamp: new Date(Date.now() - 259200000).toISOString() },
];

const MOCK_TRANSCRIPT = [
  { role: 'user', text: 'Aether, what did you learn from our last session?', timestamp: new Date(Date.now() - 120000).toISOString() },
  { role: 'aether', text: 'From our last session I crystallized three key insights. First, your preferred structure for research summaries is: background, key findings, open questions — in that order. Second, you value source citations inline rather than at the end. Third, you\'re most productive with morning sessions, so I\'ve started front-loading cognitively demanding tasks.', timestamp: new Date(Date.now() - 90000).toISOString() },
  { role: 'user', text: 'Good. Start researching the quantum computing goal now.', timestamp: new Date(Date.now() - 60000).toISOString() },
  { role: 'aether', text: 'Understood. Initiating goal execution. I\'ll begin with a dependency map before searching, and flag any tool use for your approval.', timestamp: new Date(Date.now() - 30000).toISOString() },
];