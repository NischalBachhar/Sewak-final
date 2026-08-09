import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export const createFirstSuperAdmin = async (email, password, name) => {
  try {
    console.log('Creating first superadmin...');

    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Create user document with superadmin role
    const userData = {
      uid: uid,
      name: name,
      email: email,
      role: 'superadmin',
      createdAt: new Date().toISOString(),
      isApproved: true,
      isSuspended: false,
      profileComplete: true,
      permissions: ['read', 'write', 'delete', 'approve_vendors', 'manage_admins']
    };

    await setDoc(doc(db, 'users', uid), userData);

    console.log('Superadmin created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Please use these credentials to log in as superadmin.');

    return { success: true, uid };
  } catch (error) {
    console.error('Error creating superadmin:', error);
    return { success: false, error: error.message };
  }
};

// Usage example:
// createFirstSuperAdmin('admin@gharsathi.com', 'admin123', 'Super Admin')
