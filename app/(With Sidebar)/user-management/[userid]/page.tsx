"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Combobox, ComboboxData } from "@/components/combobox";

type Profile = {
  name: string | null;
  role: string | null;
};

type UserWithProfile = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
};

const dataRole: ComboboxData = [
  { label: "Requester", value: "requester" },
  { label: "Desainer", value: "designer" },
  { label: "Admin", value: "admin" },
];

export default function EditUserPage({
  params,
}: {
  params: Promise<{ userid: string }>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [formData, setFormData] = useState<Profile>({
    name: null,
    role: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
  const router = useRouter();

  const { userid } = React.use(params);

  useEffect(() => {
    async function fetchUserData() {
      const supabase = createClient();
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, email, name, role")
          .eq("id", userid)
          .single();

        if (error || !data) {
          console.error("User with profile not found:", error);
          return;
        }

        setUser(data);
        setFormData({
          name: data.name,
          role: data.role,
        });
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [userid, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prevData) => ({ ...prevData, role: value }));
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("users")
        .update(formData)
        .eq("id", user.id);

      if (error) throw error;

      setUser((prev) => (prev ? { ...prev, ...formData } : null));
      setEditMode(false);
      setUpdateSuccess(true);
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      setUpdateError("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (user) {
      setFormData({
        name: user.name,
        role: user.role,
      });
    }
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  if (loading) {
    return (
      <Content size="md" title="Edit Profil">
        <p>Memuat data...</p>
      </Content>
    );
  }

  return (
    <Content size="md" title={`Edit Profil`}>
      {updateSuccess && (
        <Alert className="mb-4 bg-green-500 text-white">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Berhasil!</AlertTitle>
          <AlertDescription>Profil berhasil diperbarui.</AlertDescription>
        </Alert>
      )}
      {updateError && (
        <Alert variant="destructive" className="mb-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Gagal!</AlertTitle>
          <AlertDescription>{updateError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-medium">Nama</label>
          {!editMode ? (
            <p className="p-2 border rounded-md bg-muted/50">
              {user?.name || "-"}
            </p>
          ) : (
            <Input
              className="mb-4"
              placeholder="name lengkap"
              name="name"
              value={formData.name || ""}
              onChange={handleInputChange}
            />
          )}
        </div>

        <div>
          <label className="mb-2 block font-medium">Email</label>
          <Input value={user?.email || ""} disabled />
        </div>

        <div>
          <label className="mb-2 block font-medium">Role</label>
          {!editMode ? (
            <p className="p-2 border rounded-md bg-muted/50">
              {user?.role || "-"}
            </p>
          ) : (
            <Combobox
              data={dataRole}
              onChange={handleRoleChange}
              defaultValue={user?.role || ""}
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {!editMode ? (
          <Button onClick={() => setEditMode(true)}>Edit Profil</Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleCancelEdit}>
              Batal
            </Button>
            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        )}
      </div>
    </Content>
  );
}
