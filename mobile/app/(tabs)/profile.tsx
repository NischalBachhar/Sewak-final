import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const router=useRouter();
  const {profile,user,role,signOut}=useAuth();

  return <Screen>
    <Text style={styles.title}>Profile</Text>
    <View style={styles.card}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.name || user?.email || "S").slice(0,1).toUpperCase()}</Text></View>
      <Text style={styles.name}>{profile?.name || "Sewak member"}</Text>
      <Text style={styles.body}>{profile?.email || user?.email}</Text>
      <Text style={styles.role}>{role || "user"}</Text>
    </View>
    <PrimaryButton label="Sign out" variant="secondary" onPress={async()=>{await signOut();router.replace("/");}} />
  </Screen>;
}
const styles=StyleSheet.create({
  title:{color:colors.text,fontSize:28,fontWeight:"900"},
  card:{alignItems:"center",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:8},
  avatar:{width:72,height:72,borderRadius:36,backgroundColor:colors.accentLight,alignItems:"center",justifyContent:"center"},
  avatarText:{color:colors.accentStrong,fontSize:30,fontWeight:"900"},
  name:{color:colors.text,fontSize:20,fontWeight:"900"},
  body:{color:colors.muted},
  role:{color:colors.accent,fontWeight:"900",textTransform:"capitalize"}
});
