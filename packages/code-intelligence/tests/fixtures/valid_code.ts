export function greet(name: string): string {
    return `Hello, ${name}!`;
}

export class UserService {
    private users: Map<string, User> = new Map();

    async fetchUser(id: string): Promise<User> {
        return this.users.get(id)!;
    }

    async *listUsers(): AsyncGenerator<User> {
        for (const user of this.users.values()) {
            yield user;
        }
    }
}

interface User {
    id: string;
    name: string;
    email: string;
}

const DEFAULT_TIMEOUT = 5000;
