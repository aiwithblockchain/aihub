declare module 'spark-md5' {
    class SparkMD5 {
        constructor();
        append(str: string): SparkMD5;
        appendBinary(str: string): SparkMD5;
        end(raw?: boolean): string;
        reset(): SparkMD5;
        getState(): { buffer: string; buflen: number; length: number; tail: string };
        setState(state: { buffer: string; buflen: number; length: number; tail: string }): SparkMD5;
        static hash(str: string, raw?: boolean): string;
        static hashBinary(str: string, raw?: boolean): string;

        static ArrayBuffer: {
            new (): {
                append(arr: ArrayBuffer): any;
                end(raw?: boolean): string;
                reset(): any;
                getState(): { buffer: Uint8Array; length: number };
                setState(state: { buffer: Uint8Array; length: number }): any;
            };
            hash(arr: ArrayBuffer, raw?: boolean): string;
        };
    }
    export = SparkMD5;
}
