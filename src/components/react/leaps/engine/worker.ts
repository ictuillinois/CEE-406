/* The LEAPS solver, off the main thread.
 *
 * This is upstream's `worker.js` with ONE change: the engine arrives by ES
 * import instead of `importScripts`, because Vite bundles a module worker
 * and a classic one has no path to resolve. The protocol — hello / solve /
 * progress / done / error, keyed by an id and a generation — is identical,
 * which is what lets `leaps.js` be byte-for-byte upstream on both sides of
 * the wire.
 *
 * `solver.js` is a UMD: in a module worker `module` is undefined, so it
 * assigns itself to `self.LEAPS` exactly as it does under a <script> tag.
 * Importing for the side effect and reading it back off `self` is therefore
 * the whole of the adaptation.
 */
import './solver.js';

interface SelfTest { pass: boolean; errors: string[] }
interface Engine {
    version: string;
    selfTest(): SelfTest;
    solve(job: unknown, onProgress?: (p: number) => void): unknown;
}

const LEAPS = (self as unknown as { LEAPS: Engine }).LEAPS;

let selfTest: SelfTest | null = null;

self.onmessage = (e: MessageEvent) => {
    const msg = e.data || {};
    if (msg.type === 'hello') {
        if (!selfTest) selfTest = LEAPS.selfTest();
        self.postMessage({ type: 'ready', version: LEAPS.version, selfTest });
        return;
    }
    if (msg.type === 'solve') {
        try {
            const res = LEAPS.solve(msg.job, (p: number) => {
                self.postMessage({ type: 'progress', id: msg.id, kind: msg.kind, p });
            });
            self.postMessage({ type: 'done', id: msg.id, kind: msg.kind, gen: msg.gen, res });
        } catch (err) {
            self.postMessage({
                type: 'error', id: msg.id, kind: msg.kind, gen: msg.gen,
                message: String((err as Error)?.message || err),
            });
        }
    }
};
