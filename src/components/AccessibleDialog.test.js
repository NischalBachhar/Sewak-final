import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AccessibleDialog from "./AccessibleDialog";
test("dialog has a name, enters and traps focus, dismisses with Escape, and restores focus",()=>{
 const trigger=document.createElement("button");document.body.append(trigger);trigger.focus();const close=jest.fn();
 const {unmount}=render(<AccessibleDialog onDismiss={close}><h2>Edit profile</h2><button>First</button><button>Last</button></AccessibleDialog>);
 expect(screen.getByRole("dialog",{name:"Edit profile"})).toHaveAttribute("aria-modal","true");
 expect(screen.getByText("First")).toHaveFocus();
 fireEvent.keyDown(screen.getByText("First"),{key:"Tab",shiftKey:true});expect(screen.getByText("Last")).toHaveFocus();
 fireEvent.keyDown(screen.getByText("Last"),{key:"Tab"});expect(screen.getByText("First")).toHaveFocus();
 fireEvent.keyDown(screen.getByText("First"),{key:"Escape"});expect(close).toHaveBeenCalledTimes(1);
 unmount();expect(trigger).toHaveFocus();trigger.remove();
});
