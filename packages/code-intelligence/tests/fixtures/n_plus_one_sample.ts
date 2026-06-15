import { db } from './db';
import { api } from './api';

export async function processUsers(userIds: string[]) {
    const results = [];
    for (const id of userIds) {
        const user = await api.fetchUser(id);
        const orders = await db.query(`SELECT * FROM orders WHERE user_id = $1`, [id]);
        results.push({ user, orders });
    }
    return results;
}

export async function generateReport(items: any[]) {
    for (let i = 0; i < items.length; i++) {
        const detail = await api.getDetail(items[i].id);
        for (const sub of detail.subItems) {
            const subDetail = await api.getSubDetail(sub.id);
        }
    }
}
