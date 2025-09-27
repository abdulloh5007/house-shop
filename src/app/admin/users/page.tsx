import React from 'react';
import { db } from '@/lib/firebase-admin';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface UserDoc {
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
}

function initials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const [a, b] = [parts[0], parts[1]];
  return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || (a?.[0]?.toUpperCase() ?? 'U');
}

export default async function AdminUsersPage() {
  // Read minimal user fields from Firestore (server-side)
  const snapshot = await db.collection('users').select('displayName', 'username', 'photoURL').get();
  const users = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as UserDoc) }));

  // Sort alphabetically by name, fallback to username
  users.sort((a, b) => {
    const an = (a.displayName || a.username || '').toString();
    const bn = (b.displayName || b.username || '').toString();
    return an.localeCompare(bn, 'ru');
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <Card className="rounded-2xl border bg-card overflow-hidden">
          {users.map((u, idx) => {
            const name = u.displayName || 'Без имени';
            const uname = u.username ? `@${u.username}` : '';
            const showSeparator = idx < users.length - 1;

            return (
              <React.Fragment key={String((u as any).id)}>
                <div className="w-full flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      {u.photoURL ? (
                        <AvatarImage src={u.photoURL} alt={name} />
                      ) : (
                        <AvatarFallback className="text-sm font-medium">
                          {initials(name)}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="min-w-0">
                      <div className="text-[15px] font-medium truncate" title={name}>
                        {name}
                      </div>
                      {uname && (
                        <div className="text-sm text-muted-foreground truncate" title={uname}>
                          {uname}
                        </div>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {showSeparator && <div className="h-px bg-border" />}
              </React.Fragment>
            );
          })}

          {users.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground">Пользователи не найдены.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
