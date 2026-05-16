import crypto from 'node:crypto';

type SortOrder = 'asc' | 'desc';

interface BaseOwnedRecord {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface UserRecord {
  id: string;
  email: string;
  username: string | null;
  passwordHash: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

interface NodeLinkSetRecord extends BaseOwnedRecord {
  name: string;
  description: string | null;
  content: string;
}

interface PreferredAddressSetRecord extends BaseOwnedRecord {
  name: string;
  description: string | null;
  content: string;
}

interface SubscriptionRecord extends BaseOwnedRecord {
  remark: string;
  subscriptionType: string;
  publicToken: string;
  status: string;
  expiresAt: Date;
}

interface SubscriptionSnapshotRecord {
  id: string;
  subscriptionId: string;
  userId: string;
  nodeLinkSetId: string | null;
  preferredAddressSetId: string | null;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  generatorOptions: unknown;
  previewNodesJson: unknown;
  renderedContent: string;
  renderedContentEncoding: string;
  createdAt: Date;
}

type SelectMap = Record<string, boolean>;

class MemoryDb {
  private users = new Map<string, UserRecord>();
  private userSessions = new Map<string, UserSessionRecord>();
  private nodeLinkSets = new Map<string, NodeLinkSetRecord>();
  private preferredAddressSets = new Map<string, PreferredAddressSetRecord>();
  private subscriptions = new Map<string, SubscriptionRecord>();
  private snapshots = new Map<string, SubscriptionSnapshotRecord>();

  user = {
    create: async ({
      data,
      select,
    }: {
      data: { email: string; username?: string; passwordHash: string };
      select?: SelectMap;
    }) => {
      if ([...this.users.values()].some((user) => user.email === data.email || (data.username && user.username === data.username))) {
        throw new Error('User already exists');
      }
      const now = new Date();
      const record: UserRecord = {
        id: crypto.randomUUID(),
        email: data.email,
        username: data.username ?? null,
        passwordHash: data.passwordHash,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(record.id, record);
      return select ? pick(record, select) : record;
    },
    findFirst: async ({
      where,
      select,
    }: {
      where: { OR: Array<{ email?: string; username?: string }> };
      select: SelectMap;
    }) => {
      const record = [...this.users.values()].find((user) =>
        where.OR.some((condition) =>
          (condition.email !== undefined && user.email === condition.email) ||
          (condition.username !== undefined && user.username === condition.username),
        ),
      );
      return record ? pick(record, select) : null;
    },
  };

  userSession = {
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        refreshTokenHash: string;
        expiresAt: Date;
        userAgent?: string;
        ipAddress?: string;
        revokedAt?: Date | null;
      };
    }) => {
      const record: UserSessionRecord = {
        id: crypto.randomUUID(),
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
        revokedAt: data.revokedAt ?? null,
        createdAt: new Date(),
      };
      this.userSessions.set(record.id, record);
      return record;
    },
  };

  nodeLinkSet = createOwnedCollection(this.nodeLinkSets);
  preferredAddressSet = createOwnedCollection(this.preferredAddressSets);

  subscription = {
    findMany: async ({ where, orderBy }: { where: { userId: string; deletedAt: null }; orderBy: { updatedAt: SortOrder } }) =>
      sortByUpdatedAt(
        [...this.subscriptions.values()].filter((item) => item.userId === where.userId && item.deletedAt === null),
        orderBy.updatedAt,
      ),
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        remark: string;
        subscriptionType: string;
        publicToken: string;
        expiresAt: Date;
        status?: string;
      };
    }) => {
      const now = new Date();
      const record: SubscriptionRecord = {
        id: crypto.randomUUID(),
        userId: data.userId,
        remark: data.remark,
        subscriptionType: data.subscriptionType,
        publicToken: data.publicToken,
        status: data.status ?? 'active',
        expiresAt: data.expiresAt,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.subscriptions.set(record.id, record);
      return record;
    },
    findUnique: async ({ where }: { where: { publicToken?: string; id?: string } }) => {
      if (where.publicToken) {
        return [...this.subscriptions.values()].find((item) => item.publicToken === where.publicToken) ?? null;
      }
      if (where.id) {
        return this.subscriptions.get(where.id) ?? null;
      }
      return null;
    },
    updateMany: async ({ where, data }: { where: { id: string; userId: string; deletedAt: null }; data: { deletedAt: Date } }) => {
      const item = this.subscriptions.get(where.id);
      if (!item || item.userId !== where.userId || item.deletedAt !== null) {
        return { count: 0 };
      }
      item.deletedAt = data.deletedAt;
      item.updatedAt = new Date();
      return { count: 1 };
    },
  };

  subscriptionSnapshot = {
    create: async ({
      data,
    }: {
      data: Omit<SubscriptionSnapshotRecord, 'id' | 'createdAt'>;
    }) => {
      const record: SubscriptionSnapshotRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        ...data,
      };
      this.snapshots.set(record.id, record);
      return record;
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where: { subscriptionId: string };
      orderBy: { createdAt: SortOrder };
    }) => {
      const records = [...this.snapshots.values()].filter((item) => item.subscriptionId === where.subscriptionId);
      const sorted = records.sort((a, b) =>
        orderBy.createdAt === 'asc'
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime(),
      );
      return sorted[0] ?? null;
    },
  };

  async $transaction<T>(callback: (tx: MemoryDb) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

function createOwnedCollection<T extends BaseOwnedRecord & { name: string; description: string | null; content: string }>(store: Map<string, T>) {
  return {
    findMany: async ({ where, orderBy }: { where: { userId: string; deletedAt: null }; orderBy: { updatedAt: SortOrder } }) =>
      sortByUpdatedAt(
        [...store.values()].filter((item) => item.userId === where.userId && item.deletedAt === null),
        orderBy.updatedAt,
      ),
    create: async ({
      data,
    }: {
      data: { userId: string; name: string; description?: string; content: string };
    }) => {
      const now = new Date();
      const record = {
        id: crypto.randomUUID(),
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        content: data.content,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } as T;
      store.set(record.id, record);
      return record;
    },
    updateMany: async ({ where, data }: { where: { id: string; userId: string; deletedAt: null }; data: { deletedAt: Date } }) => {
      const item = store.get(where.id);
      if (!item || item.userId !== where.userId || item.deletedAt !== null) {
        return { count: 0 };
      }
      item.deletedAt = data.deletedAt;
      item.updatedAt = new Date();
      return { count: 1 };
    },
  };
}

function pick<T extends object>(value: T, select: SelectMap) {
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, record[key]]),
  );
}

function sortByUpdatedAt<T extends { updatedAt: Date }>(items: T[], order: SortOrder) {
  return items.sort((a, b) =>
    order === 'asc' ? a.updatedAt.getTime() - b.updatedAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

export const db = new MemoryDb();
