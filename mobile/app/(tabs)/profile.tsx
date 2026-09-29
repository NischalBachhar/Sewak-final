import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/auth/AuthProvider";
import {
  getCaregiverPrivateProfile,
  getMyProfile,
  updateCaregiverProfile,
  updateCustomerProfile,
} from "@/api/sewak";
import { pickAndUploadProfileImage } from "@/media/profileImage";
import { Caregiver, SewakProfile } from "@/types";
import { colors, radius, spacing } from "@/theme";

const SHIFTS = ["morning", "day", "night"];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, role, signOut, refresh } = useAuth();
  const [profile, setProfile] = useState<SewakProfile | null>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [workType, setWorkType] = useState("parttime");
  const [shifts, setShifts] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("0");
  const [experience, setExperience] = useState("0");
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      getMyProfile(user.uid),
      role === "caregiver" ? getCaregiverPrivateProfile(user.uid) : Promise.resolve(null),
    ])
      .then(([userProfile, vendor]) => {
        if (!active) return;
        setProfile(userProfile);
        setName(String(userProfile.name || user.displayName || ""));
        setPhone(String(userProfile.phone || ""));
        setAddress(String(userProfile.address || ""));
        setCity(String(userProfile.city || ""));
        if (vendor) {
          setCaregiver(vendor);
          setName(vendor.name || String(userProfile.name || ""));
          setPhone(String(vendor.phone || userProfile.phone || ""));
          setLocation(vendor.location || "");
          setBio(vendor.bio || "");
          setWorkType(vendor.workType || "parttime");
          setShifts(vendor.shifts || []);
          setHourlyRate(String(vendor.hourlyRate ?? 0));
          setExperience(String(vendor.experience ?? 0));
          setAvailable(vendor.isAvailable !== false);
        }
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Unable to load profile."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user, role]);

  if (!user) return null;
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const save = async () => {
    setError(""); setNotice("");
    if (name.trim().length < 2 || !phone.trim()) return setError("Name and phone are required.");
    setWorking(true);
    try {
      if (role === "caregiver") {
        if (location.trim().length < 2) throw new Error("Location is required.");
        await updateCaregiverProfile(user.uid, {
          name: name.trim(),
          phone: phone.trim(),
          location: location.trim(),
          bio: bio.trim().slice(0, 1000),
          workType,
          shifts: workType === "parttime" ? shifts : [],
          hourlyRate: Number(hourlyRate) || 0,
          experience: Number(experience) || 0,
          isAvailable: available,
        });
      } else if (role === "user") {
        if (address.trim().length < 5 || city.trim().length < 2) throw new Error("Address and city are required.");
        await updateCustomerProfile(user.uid, { name: name.trim(), phone: phone.trim(), address: address.trim(), city: city.trim() });
      } else {
        throw new Error("Organization and superadmin profile editing stays on the secured web dashboard.");
      }
      await refresh();
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally { setWorking(false); }
  };

  const uploadPhoto = async () => {
    setError(""); setNotice(""); setWorking(true);
    try {
      const result = await pickAndUploadProfileImage(user.uid);
      if (result) {
        setNotice("Profile photo updated.");
        await refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not upload photo."); }
    finally { setWorking(false); }
  };

  const logout = async () => {
    setWorking(true);
    try { await signOut(); router.replace("/"); }
    finally { setWorking(false); }
  };

  const toggleShift = (shift: string) =>
    setShifts((current) => current.includes(shift) ? current.filter((item) => item !== shift) : [...current, shift]);

  const editable = role === "user" || role === "caregiver";

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.identity}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase() || "S"}</Text></View>
        <Text style={styles.name}>{name || user.displayName || "Sewak member"}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.role}>{role}</Text>
        {editable ? <PrimaryButton label="Choose / change profile photo" variant="secondary" disabled={working} onPress={uploadPhoto} /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {role === "user" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer details</Text>
          <Field label="Full name *" value={name} onChangeText={setName} />
          <Field label="Phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Address *" value={address} onChangeText={setAddress} />
          <Field label="City *" value={city} onChangeText={setCity} />
          <PrimaryButton label="Save profile" loading={working} onPress={save} />
        </View>
      ) : null}

      {role === "caregiver" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Caregiver profile</Text>
          <Field label="Full name *" value={name} onChangeText={setName} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Location *" value={location} onChangeText={setLocation} />
          <Field label="About / bio" value={bio} onChangeText={setBio} multiline />
          <Field label="Hourly rate (NPR)" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
          <Field label="Experience (years)" value={experience} onChangeText={setExperience} keyboardType="numeric" />

          <Text style={styles.label}>Work type</Text>
          <View style={styles.chips}>
            <Choice label="Part time" active={workType === "parttime"} onPress={() => setWorkType("parttime")} />
            <Choice label="Full time" active={workType === "fulltime"} onPress={() => setWorkType("fulltime")} />
          </View>

          {workType === "parttime" ? (
            <>
              <Text style={styles.label}>Available shifts</Text>
              <View style={styles.chips}>
                {SHIFTS.map((shift) => <Choice key={shift} label={shift} active={shifts.includes(shift)} onPress={() => toggleShift(shift)} />)}
              </View>
            </>
          ) : null}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}><Text style={styles.label}>Accept new requests</Text><Text style={styles.muted}>Turn off when you are unavailable.</Text></View>
            <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.accentLight }} />
          </View>

          <PrimaryButton label="Save caregiver profile" loading={working} onPress={save} />
          {caregiver?.organizationName ? <Text style={styles.muted}>Organization: {caregiver.organizationName}</Text> : null}
        </View>
      ) : null}

      {!editable ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Administrative account</Text>
          <Text style={styles.body}>High-risk organization and superadmin profile/permission changes remain on the secured Sewak web dashboard.</Text>
        </View>
      ) : null}

      <PrimaryButton label="Account security" variant="secondary" onPress={() => router.push("/security")} />
      <PrimaryButton label="Sign out" variant="secondary" loading={working} onPress={logout} />
    </Screen>
  );
}

function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} placeholderTextColor="#7A8F9A" style={[styles.input, multiline && styles.multiline]} /></View>;
}
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label.replaceAll("_", " ")}</Text></Pressable>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  identity: { alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: 7 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentStrong, fontSize: 30, fontWeight: "900" },
  name: { color: colors.text, fontSize: 20, fontWeight: "900" },
  email: { color: colors.muted },
  role: { color: colors.accent, backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, textTransform: "capitalize", fontWeight: "900", fontSize: 12 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  body: { color: colors.textSecondary, lineHeight: 21 },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text },
  multiline: { minHeight: 100, paddingTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8 },
  choiceActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  choiceText: { color: colors.textSecondary, fontWeight: "800", fontSize: 12, textTransform: "capitalize" },
  choiceTextActive: { color: colors.accentStrong },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  error: { color: colors.danger, fontWeight: "800" },
  notice: { color: colors.positive, backgroundColor: colors.positiveSoft, padding: spacing.sm, borderRadius: radius.sm, fontWeight: "800" },
});
