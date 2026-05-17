# Studio — Regras permanentes para AI assistentes

## 1. Nodes do Studio: timeout configurável + animação de tempo

**Regra obrigatória para TODO node criado ou editado no Orchestrator Studio:**

Cada node que representa uma etapa de execução (LLM, vision, provider, router, categoria, etc.) **deve sempre ter**:

### 1.1 Timeout configurável
- Campo `timeoutMs` editável via painel lateral do node
- Valor padrão sensato por tipo: LLM leve = 30 000 ms, LLM pesado = 90 000 ms, ComfyUI = 300 000 ms, cloud = 60 000 ms
- O valor é salvo no `orchestrator.flow.json` e lido pelo backend para `AbortSignal.timeout()`

### 1.2 Animação de tempo em execução e em término
Implementada via `nodeTimes` (Map `nodeId → { startTs, endTs? }`) + `tick` counter (setInterval 1 s enquanto há node ativo).

**Componente visual obrigatório dentro do node:**
```
┌─────────────────────────────────────┐
│  [label]               [status dot] │
│  provider: model                    │
│  ┌── timing panel (inline) ───────┐ │
│  │  ⏱ 4.2 s    [×dismiss]        │ │
│  │  ████░░░░░░░░  42%             │ │
│  │  lim: 10s    42% usado         │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Regras do timing panel:**
- Aparece assim que `durationMs` é definido E status ≠ `"idle"`
- Enquanto `status === "active"`: exibe tempo corrente calculado como `now - startTs` (atualizado pelo `tick`)
- Quando `status === "completed"` ou `"failed"`: exibe tempo final fixo (`endTs - startTs`)
- Barra de progresso colorida por percentual de `limitMs`:
  - `< 30%` → `#22c55e` (verde)
  - `30–60%` → `#fbbf24` (amarelo)
  - `60–90%` → `#f97316` (laranja)
  - `≥ 90%` → `#ef4444` (vermelho)
- Botão `×` no canto superior direito descarta o painel; após dismissed, mostrar `TimingBadge` compacto no rodapé do node
- Ao hover com timing dismissed: mostrar `TimingTooltip` flutuante (posicionado acima do node, `bottom: calc(100% + 12px)`)

### 1.3 Helper functions obrigatórias (reutilizar as existentes)
```ts
function fmtSec(ms: number) { return (ms / 1000).toFixed(1); }
function getTimingColor(ms: number, limitMs?: number): string { ... }
```

Já implementadas em `ImageGenSubFlow.tsx` e `LLMExtractionSubFlow.tsx` — importar ou copiar ao criar novos arquivos de sub-flow.

### 1.4 Props do node (data)
Todo `NodeData` deve incluir:
```ts
timeoutMs: number;    // limite configurado — passa como limitMs para o timing panel
durationMs?: number;  // calculado pelo liveNodes useMemo
limitMs?: number;     // = timeoutMs, injetado pelo liveNodes
status?: NodeStatus;  // 'idle' | 'active' | 'completed' | 'failed'
```

### 1.5 SSE events de timing
O backend **deve** emitir:
- `stage.started { stageId, conversationId, ts }` — inicia o timer
- `stage.completed { stageId, conversationId, ts }` ou `stage.failed { ... }` — fecha o timer
- Eventos específicos do node (ex: `vision.described { durationMs }`, `image.gen_completed`) também podem carregar `durationMs` no payload para timing preciso

---

## 2. Arquitetura de categorias de geração de imagem

O pipeline de geração de imagem usa **duas categorias fixas**:
- `text2img`: providers que recebem apenas texto
- `img2img`: providers que recebem imagem de referência + texto

Cada categoria tem:
- N providers principais (escolhidos pelo LLM Router)
- 1 fallback geral (ativado se o provider escolhido falhar)
- **Sem fallback entre categorias** — falha total retorna erro

O LLM Router retorna `{ image_category, preferred_provider, reasoning }`.

---

## 3. Padrão de nomes de eventos SSE (image gen)

| Evento | Payload obrigatório |
|--------|-------------------|
| `stage.started { stageId: 'image_gen' }` | `conversationId` |
| `image.category_selected` | `category`, `conversationId` |
| `image.provider_selected` | `provider`, `category`, `reasoning`, `conversationId` |
| `image.gen_started` | `provider`, `category`, `prompt`, `conversationId` |
| `image.gen_completed` | `provider`, `category`, `conversationId` |
| `image.gen_failed` | `provider`, `category`, `error`, `conversationId` |
| `stage.completed { stageId: 'image_gen' }` | `conversationId` |
