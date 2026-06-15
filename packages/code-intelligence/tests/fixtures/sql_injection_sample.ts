import { db } from './db';

export async function getUserData(userId: string) {
    const query = `SELECT * FROM users WHERE id = ${userId}`;
    return db.execute(query);
}

export function renderUser(user: any) {
    document.getElementById('user').innerHTML = user.name;
}

export function executeCommand(cmd: string) {
    eval(cmd);
    const fn = new Function('return ' + cmd);
    return fn();
}

const API_KEY = 'sk-abcdef1234567890abcdef1234567890';
