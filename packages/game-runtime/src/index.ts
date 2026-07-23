export type GameStatus = "idle" | "running" | "paused" | "ended" | "disposed";

export type GameEvent<TState, TResult> =
  | { type: "statusChanged"; status: GameStatus }
  | { type: "stateChanged"; state: TState }
  | { type: "ended"; result: TResult }
  | { type: "error"; error: Error };

export interface GameRuntime<TConfig, TState, TInput, TResult> {
  readonly status: GameStatus;
  readonly state: TState;
  initialize(config: TConfig): void | Promise<void>;
  start(): void | Promise<void>;
  pause(): void;
  resume(): void;
  dispatch(input: TInput): void;
  dispose(): void;
  subscribe(listener: (event: GameEvent<TState, TResult>) => void): () => void;
}
