import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuthPage from "./AuthPage";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { completeRegistration } from "./registrationService";
const mockBegin=jest.fn(),mockFinish=jest.fn();let mockMode="register";
jest.mock("react-router-dom",()=>({useSearchParams:()=>[new URLSearchParams(`mode=${mockMode}`)]}),{virtual:true});
jest.mock("./firebaseConfig",()=>({auth:{currentUser:null}}));
jest.mock("firebase/auth",()=>({createUserWithEmailAndPassword:jest.fn(),signInWithEmailAndPassword:jest.fn(),sendPasswordResetEmail:jest.fn()}));
jest.mock("./AuthContext",()=>({useAuth:()=>({beginRegistration:mockBegin,finishRegistration:mockFinish,registrationPending:false})}));
jest.mock("./registrationService",()=>({completeRegistration:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();sessionStorage.clear();mockMode="register";});
test("registration mode, labels and autocomplete match the create-account link",()=>{render(<AuthPage/>);expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete","name");expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete","new-password");});
test("partial registration retries through authenticated sign-in without forced sign-out",async()=>{
 const diagnostics=jest.spyOn(console,"error").mockImplementation(()=>{});
 const account={uid:"test",email:"test@example.test"};createUserWithEmailAndPassword.mockRejectedValue({code:"auth/email-already-in-use"});signInWithEmailAndPassword.mockResolvedValue({user:account});completeRegistration.mockRejectedValueOnce({code:"unavailable",message:"PRIVATE_CONTACT_PAYLOAD",email:account.email}).mockResolvedValueOnce();
 render(<AuthPage/>);fireEvent.change(screen.getByLabelText("Full name"),{target:{value:"Synthetic Name"}});fireEvent.change(screen.getByLabelText("Email"),{target:{value:account.email}});fireEvent.change(screen.getByLabelText("Password"),{target:{value:"test-password"}});
 fireEvent.click(screen.getByRole("button",{name:"Sign up"}));await screen.findByRole("alert");expect(mockFinish).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Sign up"}));await waitFor(()=>expect(mockFinish).toHaveBeenCalledTimes(1));expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
 expect(diagnostics).toHaveBeenCalledWith("Auth error:",{code:"unavailable"});expect(JSON.stringify(diagnostics.mock.calls)).not.toMatch(/PRIVATE|test@example/);diagnostics.mockRestore();
});
test("forgot-password feedback does not reveal account existence",async()=>{
 mockMode="login";sendPasswordResetEmail.mockRejectedValue({code:"auth/user-not-found"});render(<AuthPage/>);fireEvent.change(screen.getByLabelText("Email"),{target:{value:"missing@example.test"}});fireEvent.click(screen.getByRole("button",{name:"Forgot password?"}));expect(await screen.findByText(/If this address can receive/)).toBeVisible();
});
