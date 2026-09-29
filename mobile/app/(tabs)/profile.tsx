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
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

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
        await updateCustomerProfile(user.uid, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
        });
      } else {
        throw new Error("Organization and superadmin profile editing stays on the secured web dashboard.");
      }
      await refresh();
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setWorking(false);
    }
  };

  const uploadPhoto = async () => {
    setError(""); setNotice(""); setWorking(true);
    try {
      const result = await pickAndUploadProfileImage(user.uid);
      if (result) {
        setNotice("Profile photo updated.");
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setWorking(false);
    }
  };

  const logout = async () => {
    setWorking(true);
    try {
      await signOut();
      router.replace("/");
    } finally {
      setWorking(false);
    }
  };

  const toggleShift = (shift: string) =>
    setShifts((current) =>
      current.includes(shift) ? current.filter((item) => item !== shift) : [...current, shift],
    );

  const editable = role === "user" || role === "caregiver";

  return (
    <Screen>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase() || "S"}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{name || user.displayName || "Sewak member"}</Text>
          <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
          <Text style={styles.role}>{role === "user" ? "Customer" : role}</Text>
        </View>
        {editable ? (
          <Pressable disabled={working} onPress={uploadPhoto} style={({ pressed }) => [styles.photoAction, pressed && { opacity: 0.72 }]}>
            <Text style={styles.photoActionText}>Change photo</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
      {notice ? <View style={styles.noticeBox}><Text style={styles.notice}>{notice}</Text></View> : null}

      {role === "user" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer details</Text>
          <Text style={styles.sectionHint}>Keep these details current so caregivers can reach the correct person and address.</Text>
          <Field label="Full name *" value={name} onChangeText={setName} returnKeyType="next" />
          <Field label="Phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
          <Field label="Address *" value={address} onChangeText={setAddress} textContentType="fullStreetAddress" />
          <Field label="City *" value={city} onChangeText={setCity} returnKeyType="done" />
          <PrimaryButton label="Save profile" loading={working} onPress={save} />
        </View>
      ) : null}

      {role === "caregiver" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Caregiver profile</Text>
          <Text style={styles.sectionHint}>Your public availability and rate are controlled here; verification remains platform-authoritative.</Text>
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
                {SHIFTS.map((shift) => (
                  <Choice key={shift} label={shift} active={shifts.includes(shift)} onPress={() => toggleShift(shift)} />
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Accept new requests</Text>
              <Text style={styles.muted}>Turn this off when you are unavailable.</Text>
            </View>
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

      <View style={styles.accountActions}>
        <PrimaryButton label="Account security" variant="secondary" onPress={() => router.push("/security")} />
        <PrimaryButton label="Sign out" variant="secondary" loading={working} onPress={logout} />
      </View>
    </Screen>
  );
}

function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor="#7A8F9A"
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label.replaceAll("_", " ")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.background },
  loadingText: { color: colors.muted, fontSize: 13 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 12,
  },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentStrong, fontSize: 25, fontWeight: "900" },
  identityCopy: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: colors.text, fontSize: 18, fontWeight: "900" },
  email: { color: colors.muted, fontSize: 13 },
  role: { color: colors.accentStrong, fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  photoAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  photoActionText: { color: colors.accentStrong, fontSize: 11, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 13 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  sectionHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -5 },
  body: { color: colors.textSecondary, lineHeight: 21 },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontSize: 15 },
  multiline: { minHeight: 96, paddingTop: 11 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8 },
  choiceActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  choiceText: { color: colors.textSecondary, fontWeight: "800", fontSize: 12, textTransform: "capitalize" },
  choiceTextActive: { color: colors.accentStrong },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 2 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.sm },
  error: { color: colors.danger, fontWeight: "800", fontSize: 13, lineHeight: 19 },
  noticeBox: { backgroundColor: colors.positiveSoft, borderRadius: radius.sm, padding: spacing.sm },
  notice: { color: colors.positive, fontWeight: "800", fontSize: 13 },
  accountActions: { gap: 10, paddingBottom: spacing.sm },
});
