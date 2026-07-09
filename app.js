// VERSI FINAL: API key sudah aman di backend (/api/analyze),
// bukan lagi di frontend. Fitur: foto struk, ekstrak AI, simpan,
// dashboard, filter, edit/hapus, export CSV.

const MODEL = "google/gemini-2.5-flash";

// Kalau kamu sudah setup APP_SECRET di backend (lihat catatan di bawah),
// isi string yang sama persis di sini. Kalau belum pakai proteksi ini,
// biarkan saja dan hapus baris header "x-app-secret" di fetch.
const APP_SECRET = "OPENROUTER_API_KEY"; // harus sama dengan env var APP_SECRET di Vercel
// VERSI FINAL: API key sudah aman di backend (/api/analyze),
// bukan lagi di frontend. Fitur: foto struk, ekstrak AI, simpan,
// dashboard, filter, edit/hapus, export CSV.


const cameraInput = document.getElementById("camera-input");
const statusText = document.getElementById("status-text");
const filterKategoriEl = document.getElementById("filter-kategori");
const filterBulanEl = document.getElementById("filter-bulan");
const exportBtn = document.getElementById("export-btn");
const searchInput = document.getElementById("search-input");
const themeToggleBtn = document.getElementById("theme-toggle");
const aturBudgetBtn = document.getElementById("atur-budget-btn");

let chartInstance = null;

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ---------- AMBIL FOTO & EKSTRAKSI AI ----------

cameraInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  tampilkanPreview(file);
  statusText.textContent = "Membaca struk, tunggu sebentar...";

  try {
    const base64Image = await compressImage(file);
    const dataStruk = await ekstrakDataStruk(base64Image);

    simpanTransaksi(dataStruk);
    statusText.textContent =
      `Tersimpan: ${dataStruk.toko} - Rp ${dataStruk.total.toLocaleString("id-ID")}`;

    renderDashboard();
  } catch (error) {
    console.error("Error:", error);
    statusText.textContent = "Gagal membaca struk. Cek console untuk detail error.";
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Foto dari kamera HP biasanya resolusinya tinggi (beberapa MB), jauh lebih
// besar dari foto test biasa. Ini bisa bikin request gagal karena kelewat
// batas ukuran. Fungsi ini resize + compress foto dulu sebelum dikirim.
function compressImage(file, maxWidth = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;

        // Kalau lebar foto lebih besar dari maxWidth, skalakan turun
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Hasil akhir: base64 JPEG dengan kualitas 75% (cukup buat AI baca teks)
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function ekstrakDataStruk(base64Image) {
  const systemPrompt = `Kamu adalah AI yang membaca struk belanja Indonesia.
Ekstrak informasi dari gambar struk dan balas HANYA dengan JSON (tanpa markdown, tanpa penjelasan lain), format:
{
  "toko": "nama toko/merchant",
  "tanggal": "YYYY-MM-DD",
  "total": angka_total_belanja_tanpa_titik_koma,
  "kategori": "salah satu dari: Makanan, Transport, Belanja, Hiburan, Tagihan, Lainnya"
}`;

  // Request ini sekarang ke backend kita sendiri (/api/analyze), BUKAN
  // langsung ke OpenRouter. API key OpenRouter disimpan aman di server.
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-secret": APP_SECRET, // opsional: hapus baris ini kalau backend belum pakai proteksi ini
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Baca struk ini:" },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();

  return JSON.parse(rawText);
}

// ---------- PENYIMPANAN DATA ----------

function simpanTransaksi(data) {
  const transaksi = ambilSemuaTransaksi();
  transaksi.push({ ...data, id: Date.now() });
  localStorage.setItem("transaksi", JSON.stringify(transaksi));
}

function ambilSemuaTransaksi() {
  return JSON.parse(localStorage.getItem("transaksi") || "[]");
}

function updateSemuaTransaksi(transaksi) {
  localStorage.setItem("transaksi", JSON.stringify(transaksi));
}

// ---------- EDIT & HAPUS ----------

function editTransaksi(id) {
  const transaksi = ambilSemuaTransaksi();
  const item = transaksi.find(t => t.id === id);
  if (!item) return;

  const totalBaru = prompt("Edit total (Rp):", item.total);
  if (totalBaru === null) return;

  const kategoriBaru = prompt(
    "Edit kategori (Makanan/Transport/Belanja/Hiburan/Tagihan/Lainnya):",
    item.kategori
  );
  if (kategoriBaru === null) return;

  item.total = parseInt(totalBaru, 10) || item.total;
  item.kategori = kategoriBaru.trim() || item.kategori;

  updateSemuaTransaksi(transaksi);
  renderDashboard();
}

function hapusTransaksi(id) {
  if (!confirm("Yakin mau hapus transaksi ini?")) return;

  const transaksi = ambilSemuaTransaksi().filter(t => t.id !== id);
  updateSemuaTransaksi(transaksi);
  renderDashboard();
}

// ---------- FILTER ----------

filterKategoriEl.addEventListener("change", renderDashboard);
filterBulanEl.addEventListener("change", renderDashboard);

function ambilTransaksiTerfilter() {
  const semua = ambilSemuaTransaksi();
  const kategoriTerpilih = filterKategoriEl.value;
  const bulanTerpilih = filterBulanEl.value;
  const kataKunci = searchInput.value.trim().toLowerCase();

  return semua.filter(t => {
    const cocokKategori = kategoriTerpilih === "semua" || t.kategori === kategoriTerpilih;
    const bulanTransaksi = t.tanggal ? t.tanggal.slice(0, 7) : "";
    const cocokBulan = bulanTerpilih === "semua" || bulanTransaksi === bulanTerpilih;
    const cocokPencarian = kataKunci === "" || t.toko.toLowerCase().includes(kataKunci);
    return cocokKategori && cocokBulan && cocokPencarian;
  });
}

function perbaruiOpsiBulan() {
  const semua = ambilSemuaTransaksi();
  const bulanUnik = [...new Set(semua.map(t => t.tanggal?.slice(0, 7)).filter(Boolean))];
  bulanUnik.sort().reverse();

  const valueTerpilihSaatIni = filterBulanEl.value;
  filterBulanEl.innerHTML = '<option value="semua">Semua bulan</option>';

  bulanUnik.forEach(bulan => {
    const [tahun, bulanAngka] = bulan.split("-");
    const label = `${NAMA_BULAN[parseInt(bulanAngka, 10) - 1]} ${tahun}`;
    const option = document.createElement("option");
    option.value = bulan;
    option.textContent = label;
    filterBulanEl.appendChild(option);
  });

  if ([...filterBulanEl.options].some(o => o.value === valueTerpilihSaatIni)) {
    filterBulanEl.value = valueTerpilihSaatIni;
  }
}

// ---------- EXPORT CSV ----------

exportBtn.addEventListener("click", () => {
  const transaksi = ambilSemuaTransaksi();

  if (transaksi.length === 0) {
    alert("Belum ada data untuk di-export.");
    return;
  }

  const header = "Toko,Tanggal,Kategori,Total\n";
  const rows = transaksi
    .map(t => `"${t.toko}",${t.tanggal},${t.kategori},${t.total}`)
    .join("\n");

  const csvContent = header + rows;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `pengeluaran_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
});

// ---------- DASHBOARD ----------

function renderDashboard() {
  perbaruiOpsiBulan();

  const semua = ambilSemuaTransaksi();
  const terfilter = ambilTransaksiTerfilter();

  renderTotal(semua);
  renderChart(terfilter);
  renderList(terfilter);
}

function renderTotal(transaksi) {
  const bulanIni = new Date().getMonth();
  const tahunIni = new Date().getFullYear();

  const totalBulanIni = transaksi
    .filter(t => {
      const tanggal = new Date(t.tanggal);
      return tanggal.getMonth() === bulanIni && tanggal.getFullYear() === tahunIni;
    })
    .reduce((sum, t) => sum + t.total, 0);

  document.getElementById("total-amount").textContent =
    `Rp ${totalBulanIni.toLocaleString("id-ID")}`;

  renderBudget(totalBulanIni);
}

function renderChart(transaksi) {
  const perKategori = {};
  transaksi.forEach(t => {
    perKategori[t.kategori] = (perKategori[t.kategori] || 0) + t.total;
  });

  const ctx = document.getElementById("category-chart");

  if (chartInstance) {
    chartInstance.destroy();
  }

  // Ambil warna teks sesuai tema yang lagi aktif (light/dark)
  const warnaTeks = getComputedStyle(document.documentElement)
    .getPropertyValue("--ink").trim();

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(perKategori),
      datasets: [{
        data: Object.values(perKategori),
        backgroundColor: ["#C1432B", "#1E7A5B", "#D9A441", "#445E93", "#7A4869", "#8B8272"],
        borderColor: "#FFFFFB",
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { family: "Inter", size: 12 }, color: warnaTeks },
        },
      },
    },
  });
}

function renderList(transaksi) {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  if (transaksi.length === 0) {
    list.innerHTML = '<li class="placeholder-text">Tidak ada transaksi yang cocok dengan filter</li>';
    return;
  }

  transaksi.slice().reverse().forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="transaction-row">
        <div>
          <strong class="toko">${t.toko}</strong>
          <small>${t.kategori} • ${t.tanggal}</small>
        </div>
        <span class="jumlah">Rp ${t.total.toLocaleString("id-ID")}</span>
      </div>
      <div class="item-actions">
        <button class="btn-edit">Edit</button>
        <button class="btn-hapus">Hapus</button>
      </div>
    `;

    li.querySelector(".btn-edit").addEventListener("click", () => editTransaksi(t.id));
    li.querySelector(".btn-hapus").addEventListener("click", () => hapusTransaksi(t.id));

    list.appendChild(li);
  });
}

function tampilkanPreview(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    let previewImg = document.getElementById("preview-img");

    if (!previewImg) {
      previewImg = document.createElement("img");
      previewImg.id = "preview-img";
      previewImg.style.width = "100%";
      previewImg.style.borderRadius = "12px";
      previewImg.style.marginTop = "12px";
      document.querySelector(".capture-section").appendChild(previewImg);
    }

    previewImg.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

// ---------- DARK MODE ----------

function inisialisasiTema() {
  const temaTersimpan = localStorage.getItem("tema") || "light";
  terapkanTema(temaTersimpan);
}

function terapkanTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  themeToggleBtn.textContent = tema === "dark" ? "☀️" : "🌙";
  localStorage.setItem("tema", tema);
}

themeToggleBtn.addEventListener("click", () => {
  const temaSaatIni = document.documentElement.getAttribute("data-theme") || "light";
  terapkanTema(temaSaatIni === "dark" ? "light" : "dark");
  renderChart(ambilTransaksiTerfilter());
});

// ---------- BUDGET ----------

function ambilBudget() {
  const budget = localStorage.getItem("budgetBulanan");
  return budget ? parseInt(budget, 10) : null;
}

aturBudgetBtn.addEventListener("click", () => {
  const budgetSaatIni = ambilBudget();
  const budgetBaru = prompt(
    "Masukkan budget bulanan (Rp):",
    budgetSaatIni || ""
  );

  if (budgetBaru === null) return; // cancel

  const angka = parseInt(budgetBaru.replace(/\D/g, ""), 10);

  if (!angka || angka <= 0) {
    localStorage.removeItem("budgetBulanan");
  } else {
    localStorage.setItem("budgetBulanan", angka);
  }

  renderDashboard();
});

function renderBudget(totalBulanIni) {
  const budget = ambilBudget();
  const budgetText = document.getElementById("budget-text");
  const progressFill = document.getElementById("budget-progress");

  if (!budget) {
    budgetText.textContent = "Budget belum diset";
    progressFill.style.width = "0%";
    progressFill.classList.remove("over-budget");
    return;
  }

  const persentase = Math.min((totalBulanIni / budget) * 100, 100);
  const overBudget = totalBulanIni > budget;

  budgetText.textContent =
    `Rp ${totalBulanIni.toLocaleString("id-ID")} / Rp ${budget.toLocaleString("id-ID")}`;

  progressFill.style.width = `${persentase}%`;
  progressFill.classList.toggle("over-budget", overBudget);
}

// ---------- SEARCH ----------

searchInput.addEventListener("input", renderDashboard);

// Inisialisasi tema saat halaman pertama kali dibuka
inisialisasiTema();

// Render dashboard saat halaman pertama kali dibuka
renderDashboard();

// ---------- DAFTARKAN SERVICE WORKER (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("Service worker terdaftar:", reg.scope))
      .catch((err) => console.error("Gagal daftar service worker:", err));
  });
}