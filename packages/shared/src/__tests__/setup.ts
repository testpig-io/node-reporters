/// <reference types="jest" />

// Mock FormData since it's not available in Node
interface MockFormDataEntry {
    value: any;
    filename?: string;
}

class MockFormData {
    private data: Map<string, MockFormDataEntry[]> = new Map();

    append(key: string, value: any, filename?: string) {
        if (!this.data.has(key)) {
            this.data.set(key, []);
        }
        this.data.get(key)?.push({ value, filename });
    }

    entries() {
        const entries: [string, MockFormDataEntry][] = [];
        this.data.forEach((values, key) => {
            values.forEach(entry => {
                entries.push([key, entry]);
            });
        });
        return entries[Symbol.iterator]();
    }
}

// Mock Blob since it's not available in Node
class MockBlob {
    size: number;
    type: string;

    constructor(public data: any[], options?: any) {
        this.size = data.reduce((acc, item) => acc + (item.length || 0), 0);
        this.type = options?.type || '';
    }
}

// Set up global mocks with type assertions
(global as any).FormData = MockFormData;
(global as any).Blob = MockBlob;
(global as any).fetch = jest.fn().mockImplementation(() => 
    Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('')
    })
);

// Make this a module
export {}; 