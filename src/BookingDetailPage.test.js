import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionReview } from "./BookingDetailPage";
import { submitVerifiedReview } from "./careSessionService";
jest.mock("firebase/firestore",()=>({}));
jest.mock("react-router-dom",()=>({useNavigate:()=>jest.fn(),useParams:()=>({})}),{virtual:true});
jest.mock("./firebaseConfig",()=>({db:{}}));
jest.mock("./AuthContext",()=>({useAuth:()=>({user:{uid:"customer"}})}));
jest.mock("./careSessionService",()=>({submitVerifiedReview:jest.fn()}));
test("successful verified review is immediately confirmed before the listener catches up",async()=>{
 submitVerifiedReview.mockResolvedValue();
 function Harness(){const[review,setReview]=useState(null);return <SessionReview booking={{id:"booking",status:"completed"}} existingReview={review} onSubmitted={setReview}/>;}
 render(<Harness/>);fireEvent.change(screen.getByLabelText(/Share a short note/),{target:{value:"Synthetic feedback"}});fireEvent.click(screen.getByRole("button",{name:"Submit verified review"}));
 expect(await screen.findByRole("heading",{name:"Thank you for your feedback"})).toBeVisible();expect(screen.queryByRole("button",{name:"Submit verified review"})).not.toBeInTheDocument();
});
