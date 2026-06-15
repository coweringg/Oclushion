interface User {
  id: number;
  name: string;
  email: string;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

const PI = 3.14159;

export { User, greet, calculateTotal, PI };
