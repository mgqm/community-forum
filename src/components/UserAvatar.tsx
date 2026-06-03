import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function UserAvatar({ uid, fallback, className }: {
  uid: string;
  fallback?: string;
  className?: string;
}) {
  const [userDoc] = useDocument(uid ? doc(db, 'users', uid) : null);
  const currentPhoto = userDoc?.data()?.photo_url;
  const src = currentPhoto || fallback || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
  return <img src={src} alt="" className={className} />;
}
