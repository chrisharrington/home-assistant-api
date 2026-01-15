/**
 * Type declarations for bun:test module.
 * Provides type information for VS Code IntelliSense.
 */

declare module 'bun:test' {
    export function describe(name: string, fn: () => void): void;
    export function it(name: string, fn: () => void | Promise<void>): void;
    export function test(name: string, fn: () => void | Promise<void>): void;
    export function expect<T>(value: T): {
        toBe(expected: T): void;
        toEqual(expected: T): void;
        toBeCloseTo(expected: number, numDigits?: number): void;
        toBeDefined(): void;
        toBeUndefined(): void;
        toBeNull(): void;
        toBeTruthy(): void;
        toBeFalsy(): void;
        toBeGreaterThan(expected: number): void;
        toBeGreaterThanOrEqual(expected: number): void;
        toBeLessThan(expected: number): void;
        toBeLessThanOrEqual(expected: number): void;
        toHaveLength(length: number): void;
        toHaveProperty(property: string, value?: unknown): void;
        toContain(item: unknown): void;
        toThrow(error?: string | RegExp | Error): void;
        toHaveBeenCalled(): void;
        toHaveBeenCalledWith(...args: unknown[]): void;
        toHaveBeenCalledTimes(times: number): void;
        not: {
            toBe(expected: T): void;
            toEqual(expected: T): void;
            toBeCloseTo(expected: number, numDigits?: number): void;
            toBeDefined(): void;
            toBeUndefined(): void;
            toBeNull(): void;
            toBeTruthy(): void;
            toBeFalsy(): void;
            toHaveBeenCalled(): void;
        };
    };
    export function beforeEach(fn: () => void | Promise<void>): void;
    export function afterEach(fn: () => void | Promise<void>): void;
    export function beforeAll(fn: () => void | Promise<void>): void;
    export function afterAll(fn: () => void | Promise<void>): void;
    export function mock<T extends (...args: unknown[]) => unknown>(fn?: T): T & {
        mockReset(): void;
        mockClear(): void;
        mockResolvedValue(value: unknown): void;
        mockResolvedValueOnce(value: unknown): void;
        mockRejectedValue(value: unknown): void;
        mockRejectedValueOnce(value: unknown): void;
        mockImplementation(fn: T): void;
        mockImplementationOnce(fn: T): void;
        mock: {
            calls: unknown[][];
            results: { type: 'return' | 'throw'; value: unknown }[];
        };
    };
    export function spyOn<T extends object, K extends keyof T>(
        object: T,
        method: K
    ): {
        mockImplementation(fn: T[K]): void;
        mockRestore(): void;
    };
}
