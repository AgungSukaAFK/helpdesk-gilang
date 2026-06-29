import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Rocket, Users, ArrowRight } from "lucide-react";
import Image from "next/image";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function LandingPageV3() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="#" className="flex items-center gap-2">
            <Image
              src="/gis.png"
              width={512}
              height={512}
              alt="PT. Global Inti Sejati"
              className="h-8 w-8 object-contain"
              priority
            />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold">PT. Global Inti Sejati</span>
              <span className="text-xs text-muted-foreground">
                Helpdesk Desain
              </span>
            </div>
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Fitur Unggulan
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Cara Kerja
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Kata Mereka
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="ghost" size="sm" asChild>
              <a href="/auth/login">Masuk</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="absolute -top-1/4 right-0 -z-0 h-full w-2/3 rounded-full bg-primary/10 blur-[100px]" />
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div className="max-w-xl">
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                  Ucapkan Selamat Tinggal pada Drama Desain.
                </h1>
                <p className="mt-6 text-lg leading-8 text-muted-foreground">
                  Lelah dengan brief yang berceceran di email dan revisi tanpa
                  akhir? Helpdesk Desain PT. Global Inti Sejati menyatukan semua
                  permintaan, feedback, dan file desain Anda di satu tempat yang
                  rapi.
                </p>
                <div className="mt-10 flex items-center gap-4">
                  <Button
                    size="lg"
                    className="shadow-lg shadow-primary/20"
                    asChild
                  >
                    <a href="/auth/sign-up">
                      Mulai Gratis <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a href="/dashboard">Lihat Dashboard</a>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block">
                <Image
                  src="https://images.unsplash.com/photo-1558655146-364adaf1fcc9?q=80&w=2564&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Kolaborasi tim desain"
                  width={1200}
                  height={800}
                  className="rounded-xl shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Didesain untuk Tim yang Sibuk
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Fokus pada kreativitas, bukan administrasi. Semua yang Anda
                butuhkan untuk alur kerja yang lebih lancar.
              </p>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="transform transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                    <Rocket className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Brief Anti-Bingung</CardTitle>
                  <CardDescription>
                    Formulir cerdas kami memastikan setiap detail penting
                    tertangkap dari awal. Tak ada lagi pertanyaan &quot;Ini
                    ukurannya berapa?&quot;.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="transform transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Revisi Terpusat</CardTitle>
                  <CardDescription>
                    Tinggalkan komentar, beri anotasi, dan lihat riwayat versi
                    langsung di satu tempat. Ucapkan selamat tinggal pada email
                    berantai.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="transform transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Persetujuan Satu Klik</CardTitle>
                  <CardDescription>
                    Sudah cocok? Cukup satu klik untuk memberi persetujuan.
                    Proyek selesai lebih cepat, semua orang senang.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-t border-border py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Hanya 3 Langkah Mudah
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Dari ide hingga hasil akhir, prosesnya kini lebih sederhana dari
                memesan kopi.
              </p>
            </div>
            <div className="relative mt-16">
              <div
                className="absolute left-1/2 top-0 -ml-px h-full w-0.5 bg-border hidden md:block"
                aria-hidden="true"
              />
              <div className="grid gap-12 lg:grid-cols-2">
                <div className="flex items-start gap-6">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-bold text-primary">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Ajukan Permintaan</h3>
                    <p className="mt-2 text-muted-foreground">
                      Isi brief singkat, lampirkan file pendukung jika ada, lalu
                      kirim. Kurang dari 2 menit, kami jamin.
                    </p>
                  </div>
                </div>
                <div />
                <div />
                <div className="flex items-start gap-6 lg:ml-auto lg:text-right">
                  <div>
                    <h3 className="text-xl font-semibold">Berkolaborasi</h3>
                    <p className="mt-2 text-muted-foreground">
                      Dapatkan notifikasi saat draf pertama siap. Beri masukan,
                      diskusikan revisi, semua dalam satu platform.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-bold text-primary">
                    2
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-bold text-primary">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Setujui & Unduh</h3>
                    <p className="mt-2 text-muted-foreground">
                      Setelah semua sempurna, berikan persetujuan akhir dan
                      unduh semua file yang Anda butuhkan. Selesai!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Jangan Hanya Percaya Kata Kami
              </h2>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="italic text-muted-foreground">
                    &quot;Akhirnya! Semua permintaan desain jadi teratur. Dulu
                    butuh waktu berhari-hari hanya untuk bolak-balik revisi via
                    email, sekarang semua jauh lebih cepat. Waktu tim kami jadi
                    lebih efisien.&quot;
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://i.pravatar.cc/150?img=1" />
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Aulia Dewi</p>
                      <p className="text-sm text-muted-foreground">
                        Marketing Manager, TechCorp
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="italic text-muted-foreground">
                    &quot;Sebagai desainer, ini sangat membantu. Briefnya jelas,
                    feedbacknya terpusat. Saya bisa fokus mendesain tanpa harus
                    mencari-cari detail di tumpukan email. Game-changer!&quot;
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://i.pravatar.cc/150?img=2" />
                      <AvatarFallback>BP</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Budi Prasetyo</p>
                      <p className="text-sm text-muted-foreground">
                        Lead Designer, Creative Agency
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="italic text-muted-foreground">
                    &quot;Fitur approval-nya juara. Saya bisa cepat meninjau dan
                    menyetujui desain bahkan saat sedang di luar kantor lewat
                    ponsel. Sangat direkomendasikan untuk tim yang
                    dinamis.&quot;
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://i.pravatar.cc/150?img=3" />
                      <AvatarFallback>CS</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Citra Lestari</p>
                      <p className="text-sm text-muted-foreground">
                        Project Manager, Startup
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center shadow-xl">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Sudah Siap Bekerja Lebih Cerdas?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
                Hentikan kebiasaan lama. Rasakan sendiri perbedaannya dalam
                kolaborasi tim desain PT. Global Inti Sejati.
              </p>
              <div className="mt-8">
                <Button asChild size="lg" variant="secondary">
                  <a href="/auth/signup">Coba Sekarang, Gratis!</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} PT. Global Inti Sejati. All rights
            reserved.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Ketentuan
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privasi
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Kontak
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
