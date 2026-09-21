import React from "react";
import { act, render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { getDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig";
let mockListener;
jest.mock("firebase/auth",()=>({onIdTokenChanged:(_auth,listener)=>{mockListener=listener;return jest.fn();}}));
jest.mock("firebase/firestore",()=>({doc:(_db,collection,uid)=>({collection,uid}),getDoc:jest.fn()}));
jest.mock("./firebaseConfig",()=>({auth:{currentUser:null},db:{}}));
test("a delayed former-account profile cannot overwrite a newer account or logout",async()=>{
 let resolveFirst;const first=new Promise(resolve=>{resolveFirst=resolve;});
 getDoc.mockImplementation(ref=>ref.uid==="first"?first:Promise.resolve({exists:()=>true,data:()=>({uid:ref.uid,name:"Second profile",role:"user"})}));
 const account=uid=>({uid,getIdTokenResult:async()=>({claims:{platformRole:"user"}})});
 function Consumer(){const{user,userDoc}=useAuth();return <p>{user?.uid || "signed-out"}:{userDoc?.name || "none"}</p>;}
 render(<AuthProvider><Consumer/></AuthProvider>);
 let firstRun;await act(async()=>{auth.currentUser=account("first");firstRun=mockListener(auth.currentUser);});
 await act(async()=>{auth.currentUser=account("second");await mockListener(auth.currentUser);});
 await act(async()=>{resolveFirst({exists:()=>true,data:()=>({uid:"first",name:"First profile",role:"user"})});await firstRun;});
 expect(screen.getByText("second:Second profile")).toBeInTheDocument();
 await act(async()=>{auth.currentUser=null;await mockListener(null);});expect(screen.getByText("signed-out:none")).toBeInTheDocument();
});
