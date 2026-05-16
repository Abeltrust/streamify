import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      console.error('Popup blocked by browser');
      throw new Error('Sign-in popup was blocked. Please allow popups for this site.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.error('Popup closed by user or another request initiated');
      // Silent fail or custom message
      throw new Error('Sign-in cancelled or interrupted.');
    } else if (error.message?.includes('Pending promise was never set')) {
      console.warn('Firebase internal auth state issue detected. Refreshing...');
      // This is often a non-standard environment issue
      throw new Error('Authentication system busy. Please try again in a moment.');
    }
    throw error;
  }
};
export const logout = () => signOut(auth);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
