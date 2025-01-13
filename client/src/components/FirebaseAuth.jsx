// src/components/FirebaseAuth.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig } from '../config/firebase.config';
import { createUser } from '../services/api';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
           setLoading(false);
        });

         return () => unsubscribe();
    }, []);


    const signup = async (email, password) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const user = userCredential.user;
            if (user) {
                await createUser({
                    uid: user.uid,
                    email: user.email,
                   displayName: user.displayName,
                     creationTime: user.metadata.creationTime,
                });
              return user;
            }
        } catch(error) {
             throw error;
        }
    };
    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        return signOut(auth);
    };
    const value = {
      currentUser,
        login,
        signup,
        logout,
        loading
    };

     return (
        <AuthContext.Provider value={value}>
          {!loading && children}
        </AuthContext.Provider>
      );
};

export const useAuth = () => {
    return useContext(AuthContext)
}