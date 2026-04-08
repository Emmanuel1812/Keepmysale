export interface IKnowledgeBaseItem {
  id: string;
  merchantId: string;
  title: string;
  content: string;
  contentEmbedding: number[] | null;
  category: string | null;
  language: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IKnowledgeBaseCreate {
  merchantId: string;
  title: string;
  content: string;
  contentEmbedding?: number[] | null;
  category?: string | null;
  language?: string;
  active?: boolean;
}

export interface IKnowledgeBaseUpdate {
  title?: string;
  content?: string;
  contentEmbedding?: number[] | null;
  category?: string | null;
  language?: string;
  active?: boolean;
}
