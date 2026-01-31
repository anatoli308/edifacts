# Agent Streaming Flow Audit (Updated with Scheduler)

## ✅ Vollständiger Event-Flow

### 1. **Planner Agent** (`lib/ai/agents/planner.js`)
- ✅ Sendet `agent:plan` sofort nach LLM-Fertigstellung (Zeile 133-139)
- ✅ Socket wird via `context.socket` übergeben
- ✅ Event enthält: `subtasks`, `rationale`, `goal`, `timestamp`

### 2. **Router Agent** (`lib/ai/agents/router.js`)
- ✅ Sendet `agent:step` für Pipeline-Selektion (Zeile 212-218)
- ✅ Sendet `agent:step` vor jedem Agent-Start:
  - `planner_started` (Zeile 227-232)
  - `scheduler_started` (Zeile 248-254) **NEU**
- ✅ `response:chunk` wird im Fast-Path gestreamt (Zeile 156-164)
- ✅ Ruft Scheduler auf, um Tasks zu orchestrieren (Zeile 256-285) **NEU**

### 3. **Scheduler** (`lib/ai/orchestration/scheduler.js`) **NEU INTEGRIERT**
- ✅ Sendet `agent:step` mit `task_started` für jede Task (Zeile 119-130)
- ✅ Sendet `agent:step` mit `task_completed` nach Task-Erfolg (Zeile 175-186)
- ✅ Sendet `agent:step` mit `task_validation_failed` bei Fehler (Zeile 152-160)
- ✅ Orchestriert Executor-Aufrufe basierend auf Dependencies
- ✅ Führt parallele Tasks aus (maxParallel: 2)

### 4. **Executor Agent** (`lib/ai/agents/executor.js`)
- ✅ Wird vom Scheduler pro Task aufgerufen
- ✅ Sendet `agent:tool_call` **vor** Tool-Ausführung (Zeile 151-158)
- ✅ Sendet `agent:tool_result` **nach** Tool-Ausführung (Zeile 169-178)
- ✅ Sendet `response:chunk` während LLM-Streaming (Zeile 357-364)
- ✅ Sendet finales `response:chunk` mit `isComplete: true` (Zeile 372-377)

### 5. **Critic Agent** (`lib/ai/agents/critic.js`)
- ✅ Wird vom Scheduler pro Task aufgerufen
- ✅ Validiert jede Task einzeln (keine globale Validierung mehr)

### 6. **Socket Handler** (`lib/socket/handlers/agentHandlers.js`)
- ✅ Sendet `agent:started` zu Beginn (Zeile 123-127)
- ✅ Sendet `agent:completed` am Ende (Zeile 183-197)
- ✅ **KEINE** redundanten Emits mehr - alles wird live gestreamt
- ✅ Kommentar erklärt, dass Streaming direkt von Agents kommt (Zeile 177-182)

### 7. **useAgentStreaming Hook** (`app/_hooks/useAgentStreaming.js`)
- ✅ Hört auf `agent:started` (Zeile 63-86)
- ✅ Hört auf `agent:plan` (Zeile 100-115)
- ✅ Hört auf `agent:step` (Zeile 117-133) **→ empfängt auch Task-Progress**
- ✅ Hört auf `agent:tool_call` (Zeile 135-150)
- ✅ Hört auf `agent:tool_result` (Zeile 152-175)
- ✅ Hört auf `response:chunk` (Zeile 177-185)
- ✅ Hört auf `agent:completed` (Zeile 187-214)
- ✅ Hört auf `agent:failed` (Zeile 216-245)
- ✅ Alle Listener korrekt registriert (Zeile 270-277)
- ✅ Cleanup im useEffect return (Zeile 279-289)

---

## 🎯 Erwarteter Event-Ablauf (FULL_PIPELINE mit Scheduler)

1. **User sendet Nachricht** → `socket.emit('agent:invoke', ...)`
2. **Handler empfängt** → `agent:started`
3. **Router klassifiziert** → `agent:step` (pipeline_selected, FULL_PIPELINE)
4. **Router ruft Planner** → `agent:step` (planner_started)
5. **Planner analysiert** → `agent:plan` (mit 3 Subtasks)
6. **Router ruft Scheduler** → `agent:step` (scheduler_started)
7. **Scheduler orchestriert Tasks**:
   - **Task 1 Start** → `agent:step` (task_started, progress: 1/3)
   - **Executor führt aus** → `agent:tool_call`, `agent:tool_result`, `response:chunk`
   - **Critic validiert** → (intern)
   - **Task 1 Complete** → `agent:step` (task_completed, progress: 1/3)
   - **Task 2 Start** → `agent:step` (task_started, progress: 2/3)
   - **Executor führt aus** → `agent:tool_call`, `agent:tool_result`, `response:chunk`
   - **Task 2 Complete** → `agent:step` (task_completed, progress: 2/3)
   - **Task 3 Start** → `agent:step` (task_started, progress: 3/3)
   - **Executor führt aus** → `agent:tool_call`, `agent:tool_result`, `response:chunk`
   - **Task 3 Complete** → `agent:step` (task_completed, progress: 3/3)
8. **Handler sendet Completion** → `agent:completed` (mit Scheduler-Metriken)

---

## 🎯 Erwarteter Event-Ablauf (FAST_PATH - unverändert)

1. **User sendet Nachricht** → `socket.emit('agent:invoke', ...)`
2. **Handler empfängt** → `agent:started`
3. **Router klassifiziert** → (intern, kein Event)
4. **Router ruft LLM direkt** → `response:chunk` (Streaming)
5. **Router fertig** → `response:chunk` mit `isComplete: true`
6. **Handler sendet Completion** → `agent:completed`

---

## ✅ Scheduler Integration ABGESCHLOSSEN!

### Was wurde hinzugefügt:
1. ✅ **orchestration/index.js** - Export von Scheduler, TaskGraph, ReplayManager
2. ✅ **Router Integration** - Scheduler wird nach Planner aufgerufen
3. ✅ **Task-Progress Events** - `task_started`, `task_completed`, `task_validation_failed`
4. ✅ **Parallele Ausführung** - maxParallel: 2 Tasks gleichzeitig
5. ✅ **Dependency Resolution** - Topologische Sortierung respektiert Dependencies
6. ✅ **Metriken** - tasksRun, tasksCompleted, tasksFailed, toolsCalled, replans
7. ✅ **Critic pro Task** - Validierung nach jeder Task (nicht mehr am Ende)

### Vorteile:
- 🚀 **Parallel Tasks**: Unabhängige Tasks laufen gleichzeitig
- 📊 **Progress Tracking**: UI zeigt Task 1/3, 2/3, 3/3
- 🔄 **Smart Dependencies**: Tasks warten auf ihre Dependencies
- ✅ **Frühe Validierung**: Fehler werden pro Task erkannt, nicht erst am Ende
- 📈 **Bessere Metriken**: Detaillierte Execution Traces

---

## 🚀 Status: SCHEDULER VOLLSTÄNDIG INTEGRIERT

Alle Events werden jetzt in Echtzeit gestreamt MIT intelligenter Task-Orchestrierung:
- ✅ Plan sofort nach Generierung
- ✅ Scheduler orchestriert Tasks (parallel + Dependencies)
- ✅ Task Progress (Started, Completed, Failed) mit 1/N, 2/N, 3/N
- ✅ Tool Calls VOR Ausführung (pro Task)
- ✅ Tool Results NACH Ausführung (pro Task)
- ✅ Response Chunks während LLM-Streaming (pro Task)
- ✅ Completion am Ende mit Scheduler-Metriken

**System ist Enterprise-Ready!** 🎉
