# Security Specification - Community Forum

## Data Invariants
1. A user profile (`/users/{uid}`) can only be created with a `uid` matching the authenticated user.
2. Only the owner of a post can edit or delete it.
3. Anyone signed in can view posts and comments.
4. Anyone signed in can like a post.
5. A user can only like a post once (enforced by document ID being `uid`).
6. Liking/Unliking a post must atomically update `likesCount`.
7. Creating a comment must atomically update `commentsCount`.
8. User cannot modify `createdAt` or `authorId` after creation.

## The Dirty Dozen Payloads (Targeting Rejection)

1. **Identity Spoofing**: Try to create a user profile with a different UID.
2. **Post Injection**: Try to create a post with `authorId` as another user.
3. **Malicious Like**: Try to increment `likesCount` by 10 in a single update.
4. **Illegal Edit**: Non-owner trying to update a post's content.
5. **Timestamp Faking**: Post created with a future `createdAt`.
6. **Ghost Field**: Adding `isAdmin: true` to a user profile.
7. **Junk ID**: Creating a post with a 2KB garbage string as ID.
8. **Negative Stats**: Setting `likesCount` to -1.
9. **Comment Hijack**: Deleting someone else's comment (if not the post owner).
10. **Resource Exhaustion**: Sending a 5MB string in the `content` field.
11. **Orphaned Like**: Creating a like for a post that doesn't exist.
12. **Double Like**: Trying to create a second like document for the same user on the same post.
