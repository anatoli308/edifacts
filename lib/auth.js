import User from '@/app/models/User';
import dbConnect from '@/app/lib/dbConnect';

export async function getAuthenticatedUser(request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return null;
    await dbConnect();
    const user = await User.findById(userId);
    if (!user || user.banned) return null;
    return user;
}