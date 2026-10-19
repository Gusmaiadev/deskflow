import type { Role } from '../../generated/prisma/enums.js';
import type { CommentWithAuthor } from './comments.repository.js';

/** DTO de saída de um comentário. */
export type CommentResponse = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  author: { id: string; name: string; role: Role };
};

export function toCommentResponse(comment: CommentWithAuthor): CommentResponse {
  return {
    id: comment.id,
    body: comment.body,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt,
    author: comment.author,
  };
}
