// Pemisahan butir acuan BAN-PT (instrumen akreditasi PTKL/LPNK) yang "gemuk"
// (satu butir mencampur 2-3 elemen A/B/C yang masing-masing punya target
// pencapaian sendiri) menjadi butir-butir terpisah per elemen, mis. PTKL-08
// -> PTKL-08A + PTKL-08B. Bagian pertama (index 0) SELALU memakai kembali
// baris ref_items + standard_indicators yang sudah ada (supaya penugasan dan
// riwayat PPEPP/audit yang sudah ada tidak hilang); bagian berikutnya (B, C)
// dibuat sebagai baris baru. Lihat revisiPisahkanButirBANPT() di db.js.
export const PEMISAHAN_BUTIR_BANPT = [
  {
    kodeAsli: 'PTKL-06',
    targetLamaGabungan: "PKTJ memiliki Renstra pengelolaan SDM yang telah dievaluasi keterlaksanaannya dalam 3 tahun terakhir dengan melibatkan pemangku kepentingan internal, disertai tenaga kependidikan yang kompeten, dan rasio mahasiswa-dosen (RMDT) berada pada rentang 20 sampai dengan 40.",
    bagian: [
      {
        kode: 'PTKL-06A',
        judul: 'Ketersediaan dan Kualifikasi Dosen/Tenaga Pendidik',
        uraian:
          'PTKL/LPNK memiliki Rencana Strategis pengelolaan Sumber daya Manusia (SDM) yang menunjukkan analisis terhadap kecukupan dosen dan tenaga kependidikan berdasarkan kebutuhan, kualifikasi, keahlian dan pengalaman yang dibutuhkan oleh PTKL/LPNK. A. Ketersediaan (Dosen)/Tenaga Pendidik yang berkompeten dan berkualifikasi pada tahun tahun sekarang (TS). Catatan: 1. Kompetensi dosen/tenaga pendidik meliputi kompetensi pedagogik, kepribadian, sosial, dan profesional. 2. Kualifikasi dosen/tenaga pendidik adalah sesuai dengan ketentuan peraturan perundang-undangan yang ditetapkan Kementerian lain/LPNK, baik jenjang pendidikan maupun jabatan akademiknya. 3. Pemenuhan kualifikasi dosen yang berasal dari praktisi dapat dilakukan melalui rekognisi pembelajaran lampau sebagai alternatif pemenuhan kualifikasi dosen praktisi.',
        target:
          'PKTJ memiliki Renstra pengelolaan SDM yang telah dievaluasi keterlaksanaannya dalam 3 tahun terakhir dengan melibatkan pemangku kepentingan internal, disertai ketersediaan dosen/tenaga pendidik yang kompeten dan berkualifikasi sesuai ketentuan yang berlaku.',
        satuan: '%',
        strategy:
          'Menyusun dan mengevaluasi Renstra pengelolaan SDM secara berkala melibatkan pemangku kepentingan internal, guna mencapai target: “PKTJ memiliki Renstra pengelolaan SDM yang telah dievaluasi keterlaksanaannya dalam 3 tahun terakhir dengan melibatkan pemangku kepentingan internal, disertai ketersediaan dosen/tenaga pendidik yang kompeten dan berkualifikasi sesuai ketentuan yang berlaku.”',
        buktiSahih:
          'Dokumen Renstra SDM, hasil evaluasi keterlaksanaan, dan data kualifikasi/kompetensi dosen, sesuai target: “PKTJ memiliki Renstra pengelolaan SDM yang telah dievaluasi keterlaksanaannya dalam 3 tahun terakhir dengan melibatkan pemangku kepentingan internal, disertai ketersediaan dosen/tenaga pendidik yang kompeten dan berkualifikasi sesuai ketentuan yang berlaku.”',
      },
      {
        kode: 'PTKL-06B',
        judul: 'Ketersediaan Tenaga Kependidikan',
        uraian:
          'B. Ketersediaan tenaga kependidikan untuk melaksanakan administrasi, pengelolaan, pengembangan, pengawasan, dan pelayanan teknis.',
        target:
          'PKTJ memiliki tenaga kependidikan yang kompeten dan mencukupi untuk melaksanakan fungsi administrasi, pengelolaan, pengembangan, pengawasan, dan pelayanan teknis.',
        satuan: '%',
        strategy:
          'Merencanakan dan memenuhi kebutuhan tenaga kependidikan sesuai fungsi administrasi, pengelolaan, pengembangan, pengawasan, dan pelayanan teknis, guna mencapai target: “PKTJ memiliki tenaga kependidikan yang kompeten dan mencukupi untuk melaksanakan fungsi administrasi, pengelolaan, pengembangan, pengawasan, dan pelayanan teknis.”',
        buktiSahih:
          'Data dan dokumen kepegawaian tenaga kependidikan (kualifikasi, penempatan, uraian tugas), sesuai target: “PKTJ memiliki tenaga kependidikan yang kompeten dan mencukupi untuk melaksanakan fungsi administrasi, pengelolaan, pengembangan, pengawasan, dan pelayanan teknis.”',
      },
      {
        kode: 'PTKL-06C',
        judul: 'Rasio Mahasiswa terhadap Dosen Tetap (RMDT)',
        uraian:
          'C. Rasio jumlah mahasiswa aktif (Sarjana Terapan, Diploma Tiga) dibagi jumlah dosen tetap saat TS. RMDT = NM / NDT. NM = Jumlah mahasiswa (reguler dan transfer) pada program utama pada saat TS. NDT = Jumlah dosen tetap.',
        target: 'Rasio mahasiswa terhadap dosen tetap (RMDT) PKTJ berada pada rentang 20 sampai dengan 40.',
        satuan: 'Rasio',
        strategy:
          'Memantau dan mengendalikan rasio mahasiswa terhadap dosen tetap (RMDT) melalui perencanaan penerimaan mahasiswa dan rekrutmen dosen, guna mencapai target: “Rasio mahasiswa terhadap dosen tetap (RMDT) PKTJ berada pada rentang 20 sampai dengan 40.”',
        buktiSahih:
          'Data jumlah mahasiswa aktif dan dosen tetap serta perhitungan RMDT per tahun akademik, sesuai target: “Rasio mahasiswa terhadap dosen tetap (RMDT) PKTJ berada pada rentang 20 sampai dengan 40.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-07',
    targetLamaGabungan: "PKTJ memiliki dosen tetap berkualifikasi Doktor/Doktor Terapan atau setara sekurang-kurangnya 17,5% dari total dosen tetap, dengan persentase keterlibatan Dosen Tidak Tetap kurang dari 40% dari jumlah dosen tetap.",
    bagian: [
      {
        kode: 'PTKL-07A',
        judul: 'Kecukupan dan Kualifikasi Dosen Tetap',
        uraian:
          'Syarat Perlu status terakreditasi unggul: A. Kecukupan jumlah dosen dengan kualifikasi Doktor atau Instruktur/Widyaiswara yang memenuhi kompetensi sebagaimana diatur oleh Kementerian Lain atau LPNK terkait, untuk melaksanakan tugas dan fungsi sebagai teladan, pendidik dan perancang pembelajaran, fasilitator, serta motivator mahasiswa. Dengan memperhatikan aspek berikut: Dosen untuk 1 (satu) program studi paling sedikit berjumlah: 5 (lima) orang pada program sarjana terapan atau diploma Tiga sedangkan Instruktur/Widyaiswara sesuai dengan kebutuhan PTKL/LPNK dan memperhatikan ketentuan yang berlaku.',
        target:
          'PKTJ memiliki dosen tetap berkualifikasi Doktor/Doktor Terapan atau setara sekurang-kurangnya 17,5% dari total dosen tetap, dengan jumlah dosen tiap program studi paling sedikit 5 (lima) orang (syarat perlu status Terakreditasi Unggul).',
        satuan: '%',
        strategy:
          'Merencanakan rekrutmen dan pengembangan kualifikasi dosen tetap (termasuk studi lanjut Doktor/Doktor Terapan) sesuai kebutuhan program studi, guna mencapai target: “PKTJ memiliki dosen tetap berkualifikasi Doktor/Doktor Terapan atau setara sekurang-kurangnya 17,5% dari total dosen tetap, dengan jumlah dosen tiap program studi paling sedikit 5 (lima) orang (syarat perlu status Terakreditasi Unggul).”',
        buktiSahih:
          'Data kepegawaian dosen tetap (ijazah, jabatan akademik) dan rekap jumlah dosen per program studi, sesuai target: “PKTJ memiliki dosen tetap berkualifikasi Doktor/Doktor Terapan atau setara sekurang-kurangnya 17,5% dari total dosen tetap, dengan jumlah dosen tiap program studi paling sedikit 5 (lima) orang (syarat perlu status Terakreditasi Unggul).”',
      },
      {
        kode: 'PTKL-07B',
        judul: 'Keterlibatan Dosen Tidak Tetap (DTT)',
        uraian:
          'B. Keterlibatan Dosen Tidak Tetap (DTT). PDTT = (NDTT / (NDT + NDTT)) x 100%. NDTT = Jumlah dosen tidak tetap. NDT = Jumlah dosen tetap.',
        target: 'Persentase keterlibatan Dosen Tidak Tetap (PDTT) PKTJ kurang dari 40% dari jumlah dosen tetap.',
        satuan: '%',
        strategy:
          'Mengatur komposisi dan mengendalikan proporsi dosen tidak tetap melalui perencanaan kebutuhan dosen tetap, guna mencapai target: “Persentase keterlibatan Dosen Tidak Tetap (PDTT) PKTJ kurang dari 40% dari jumlah dosen tetap.”',
        buktiSahih:
          'Data dan rekap jumlah dosen tetap serta dosen tidak tetap beserta perhitungan PDTT, sesuai target: “Persentase keterlibatan Dosen Tidak Tetap (PDTT) PKTJ kurang dari 40% dari jumlah dosen tetap.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-08',
    targetLamaGabungan: "PKTJ terbukti menyediakan akses sarana-prasarana yang sangat memadai serta terbukti menerapkan kebijakan K3 secara efektif mencakup seluruh unsur yang dipersyaratkan.",
    bagian: [
      {
        kode: 'PTKL-08A',
        judul: 'Ketersediaan Akses Sarana Prasarana Pendidikan',
        uraian:
          'A. Ketersediaan akses terhadap sarana dan prasarana yang mendukung penyelenggaraan pendidikan dan pembelajaran, memenuhi aspek-aspek sebagai berikut: 1. PTKL/LPNK menjamin dan menyediakan akses terhadap sarana dan prasarana disesuaikan dengan pilihan fokus diferensiasi misi perguruan tinggi pada bidang pendidikan, atau penelitian dan atau pengabdian kepada masyarakat yang: a. mengakomodasi kebutuhan pendidikan mahasiswa; b. mengakomodasi pelaksanaan tugas dosen, dan pembimbing sesuai dengan bidang keahlian dan tenaga kependidikan; c. ramah terhadap mahasiswa, dosen, dan tenaga kependidikan yang berkebutuhan khusus; d. memadai untuk menyelenggarakan pendidikan dan manajemen pendidikan tinggi sesuai kebutuhan penyelenggaraan dan rencana pengembangan pendidikan. 2. Penyediaan akses terhadap sarana dan prasarana mencakup: i. teknologi informasi dan komunikasi yang andal untuk mendukung penyelenggaraan pendidikan; dan ii. sumber pembelajaran. iii. SarPras yang dimiliki dapat diakses oleh mahasiswa baik dari dalam dan luar kampus. 3. PTKL/LPNK dapat melibatkan dunia usaha, dunia industri, dan dunia kerja dalam penyediaan fasilitas pembelajaran dan pelatihan.',
        target:
          'PKTJ terbukti menyediakan akses sarana-prasarana yang sangat memadai sesuai kebutuhan penyelenggaraan tridharma dan fokus diferensiasi misi.',
        satuan: '%',
        strategy:
          'Menyusun rencana strategis dan kebijakan pengelolaan sarana-prasarana sesuai kebutuhan penyelenggaraan tridharma, guna mencapai target: “PKTJ terbukti menyediakan akses sarana-prasarana yang sangat memadai sesuai kebutuhan penyelenggaraan tridharma dan fokus diferensiasi misi.”',
        buktiSahih:
          'Dokumen rencana strategis sarana-prasarana dan bukti akses TIK/sumber belajar bagi mahasiswa serta dosen, sesuai target: “PKTJ terbukti menyediakan akses sarana-prasarana yang sangat memadai sesuai kebutuhan penyelenggaraan tridharma dan fokus diferensiasi misi.”',
      },
      {
        kode: 'PTKL-08B',
        judul: 'Sistem Keamanan, Keselamatan, dan Kesehatan Kerja (K3)',
        uraian:
          'B. Sistem K3 (Keamanan, Keselamatan dan kesehatan). Penjaminan dan penyediaan akses terhadap sarana dan prasarana dilakukan dengan memenuhi ketentuan: a) keamanan, keselamatan, dan kesehatan; b) kelengkapan pencegahan dan pemadam kebakaran serta penanggulangan kondisi darurat akibat bencana alam lainnya; c) pengelolaan sampah serta limbah bahan berbahaya dan beracun; d) penyediaan akses yang memenuhi standar kesehatan kerja dan menjamin lingkungan kerja yang sehat; e) mengamankan seluruh fasilitas kampus dari pengaruh negatif NAPZA, misalnya rokok, alkohol, narkotika dan lainnya.',
        target:
          'PKTJ terbukti menerapkan kebijakan K3 secara efektif mencakup seluruh unsur yang dipersyaratkan.',
        satuan: '%',
        strategy:
          'Menyusun dan menerapkan SOP K3 mencakup keamanan, keselamatan, kesehatan kerja, dan pengelolaan limbah, guna mencapai target: “PKTJ terbukti menerapkan kebijakan K3 secara efektif mencakup seluruh unsur yang dipersyaratkan.”',
        buktiSahih:
          'Dokumen SOP K3 dan rekaman pelaksanaannya (mis. hasil audit K3 internal, sertifikat sarana pemadam kebakaran), sesuai target: “PKTJ terbukti menerapkan kebijakan K3 secara efektif mencakup seluruh unsur yang dipersyaratkan.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-10',
    targetLamaGabungan: "PKTJ memiliki bukti sahih praktik baik penyelenggaraan proses pembelajaran yang mencakup kelima aspek terkait, telah dievaluasi dan diperbaiki secara berkelanjutan untuk peningkatan proses pembelajaran.",
    bagian: [
      {
        kode: 'PTKL-10A',
        judul: 'Evaluasi dan Perbaikan Berkelanjutan Proses Pembelajaran',
        uraian:
          'A. Keseluruhan proses pembelajaran diperbaiki dan ditingkatkan secara berkelanjutan oleh perguruan tinggi berdasarkan hasil evaluasi terkait aspek berikut: a. aktivitas pembelajaran pada setiap angkatan; b. jumlah mahasiswa aktif pada setiap angkatan; c. masa tempuh kurikulum; d. masa penyelesaian studi mahasiswa; dan e. tingkat serapan lulusan di dunia kerja dan pasar kerja global.',
        target:
          'PKTJ memiliki bukti sahih praktik baik penyelenggaraan proses pembelajaran yang mencakup kelima aspek terkait (aktivitas pembelajaran, jumlah mahasiswa aktif, masa tempuh kurikulum, masa penyelesaian studi, dan tingkat serapan lulusan), telah dievaluasi dan diperbaiki secara berkelanjutan.',
        satuan: '%',
        strategy:
          'Melaksanakan evaluasi proses pembelajaran secara berkala dan menindaklanjuti hasilnya sebagai perbaikan berkelanjutan, guna mencapai target: “PKTJ memiliki bukti sahih praktik baik penyelenggaraan proses pembelajaran yang mencakup kelima aspek terkait (aktivitas pembelajaran, jumlah mahasiswa aktif, masa tempuh kurikulum, masa penyelesaian studi, dan tingkat serapan lulusan), telah dievaluasi dan diperbaiki secara berkelanjutan.”',
        buktiSahih:
          'Laporan evaluasi proses pembelajaran dan bukti tindak lanjut perbaikan per angkatan, sesuai target: “PKTJ memiliki bukti sahih praktik baik penyelenggaraan proses pembelajaran yang mencakup kelima aspek terkait (aktivitas pembelajaran, jumlah mahasiswa aktif, masa tempuh kurikulum, masa penyelesaian studi, dan tingkat serapan lulusan), telah dievaluasi dan diperbaiki secara berkelanjutan.”',
      },
      {
        kode: 'PTKL-10B',
        judul: 'Pemenuhan Beban Belajar di Luar Program Studi (MBKM)',
        uraian:
          'B. Persentase mahasiswa yang eligible memenuhi beban belajar diluar Program Studi pada tahun TS untuk Program Sarjana dan Sarjana Terapan/D3 dengan jumlah sks minimal 10 sks.',
        target:
          'Seluruh mahasiswa PKTJ yang eligible memenuhi beban belajar di luar program studi pada tahun berjalan (TS) dengan jumlah minimal 10 sks. (diturunkan dari uraian butir — teks target asli tidak menyebut elemen ini secara eksplisit)',
        satuan: '%',
        strategy:
          'Memfasilitasi dan memantau keikutsertaan mahasiswa dalam program pembelajaran di luar program studi (MBKM) sesuai skema hak belajar, guna mencapai target: “Seluruh mahasiswa PKTJ yang eligible memenuhi beban belajar di luar program studi pada tahun berjalan (TS) dengan jumlah minimal 10 sks.”',
        buktiSahih:
          'Data peserta dan transkrip konversi sks kegiatan pembelajaran di luar program studi, sesuai target: “Seluruh mahasiswa PKTJ yang eligible memenuhi beban belajar di luar program studi pada tahun berjalan (TS) dengan jumlah minimal 10 sks.”',
      },
      {
        kode: 'PTKL-10C',
        judul: 'Karakteristik Pelaksanaan Proses Pembelajaran',
        uraian:
          'C. Pelaksanaan proses pembelajaran diselenggarakan dengan: a. menciptakan suasana belajar yang menyenangkan, inklusif, kolaboratif, kreatif, dan efektif; b. memberikan kesempatan belajar yang sama tanpa membedakan latar belakang pendidikan, sosial, ekonomi, budaya, bahasa, jalur penerimaan mahasiswa, dan kebutuhan khusus mahasiswa; c. menjamin keamanan, kenyamanan, kesejahteraan hidup sivitas akademika; d. memberikan fleksibilitas dalam proses pendidikan untuk memfasilitasi pendidikan berkelanjutan sepanjang hayat; e. menggunakan platform digital dalam memfasilitasi kebutuhan belajar dan pemenuhan capaian pembelajaran mahasiswa.',
        target:
          'PKTJ menyelenggarakan proses pembelajaran yang memenuhi kelima karakteristik (menyenangkan-inklusif-kolaboratif-kreatif-efektif, kesetaraan kesempatan belajar, keamanan-kenyamanan-kesejahteraan sivitas akademika, fleksibilitas pendidikan berkelanjutan, dan pemanfaatan platform digital pembelajaran) secara konsisten. (diturunkan dari uraian butir — teks target asli tidak menyebut elemen ini secara eksplisit)',
        satuan: '%',
        strategy:
          'Menerapkan dan memantau praktik pembelajaran yang menyenangkan, inklusif, aman, fleksibel, dan berbasis platform digital, guna mencapai target: “PKTJ menyelenggarakan proses pembelajaran yang memenuhi kelima karakteristik (menyenangkan-inklusif-kolaboratif-kreatif-efektif, kesetaraan kesempatan belajar, keamanan-kenyamanan-kesejahteraan sivitas akademika, fleksibilitas pendidikan berkelanjutan, dan pemanfaatan platform digital pembelajaran) secara konsisten.”',
        buktiSahih:
          'Dokumentasi pelaksanaan pembelajaran (RPS, rekaman kelas, survei kepuasan mahasiswa) dan bukti penggunaan platform digital pembelajaran, sesuai target: “PKTJ menyelenggarakan proses pembelajaran yang memenuhi kelima karakteristik (menyenangkan-inklusif-kolaboratif-kreatif-efektif, kesetaraan kesempatan belajar, keamanan-kenyamanan-kesejahteraan sivitas akademika, fleksibilitas pendidikan berkelanjutan, dan pemanfaatan platform digital pembelajaran) secara konsisten.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-12',
    targetLamaGabungan: "PKTJ terbukti menyusun analisis dan evaluasi sistematis terhadap seluruh capaian kinerja penyelesaian studi, dengan target: RPPL < 20%, PKMTK > 50%, PK2MTK > 70%, rata-rata produk/jasa yang dimanfaatkan masyarakat/DUDIK > 20% program studi aktif, dan sertifikasi kompetensi > 50% dari jumlah lulusan.",
    bagian: [
      {
        kode: 'PTKL-12A',
        judul: 'Penyelesaian Studi Lulusan',
        uraian:
          'A. Penyelesaian studi lulusan sebagai berikut; 1) Rerata persentase penurunan lulusan (Sarjana Terapan dan Diploma Tiga) dalam 3 tahun terakhir (RPPL). 2) Kelulusan sesuai dengan masa tempuh kurikulum (mahasiswa Sarjana Terapan, yang terdaftar aktif sebagai mahasiswa mulai masuk TS-3, lulus pada saat TS, mahasiswa Diploma Tiga masuk TS-2, lulus TS). Sasaran penilaiannya dalam tiga tahun terakhir untuk tiga angkatan mahasiswa terakhir (PKMTK). 3) Kelulusan tidak melebihi 2 (dua) kali waktu tempuh kurikulum (mahasiswa Sarjana Terapan masuk TS-6 lulus sampai TS, mahasiswa Diploma Tiga masuk TS-4 lulus sampai TS dan rerata pengamatan dalam tiga tahun terakhir untuk tiga angkatan mahasiswa terakhir (PK2MTK). 4) Produk dan jasa yang dimanfaatkan Kementerian/LPNK terkait, masyarakat dan DUDIK. 5) Sertifikat kompetensi dalam proses pendidikan Pendidikan Kedinasan pada Jalur Pendidikan Formal; atau sertifikat kompetensi, dan/atau sertifikat profesi pada Pendidikan Tinggi Nonkedinasan.',
        target:
          'RPPL < 20%, PKMTK > 50%, PK2MTK > 70%, rata-rata produk/jasa yang dimanfaatkan masyarakat/DUDIK > 20% program studi aktif, dan sertifikasi kompetensi > 50% dari jumlah lulusan.',
        satuan: '%',
        strategy:
          'Memantau dan mengevaluasi capaian luaran tridharma (RPPL, PKMTK, PK2MTK, pemanfaatan produk/jasa, dan sertifikasi kompetensi) secara berkala, disertai tindak lanjut perbaikan, guna mencapai target: “RPPL < 20%, PKMTK > 50%, PK2MTK > 70%, rata-rata produk/jasa yang dimanfaatkan masyarakat/DUDIK > 20% program studi aktif, dan sertifikasi kompetensi > 50% dari jumlah lulusan.”',
        buktiSahih:
          'Data capaian dan laporan penyelesaian studi serta pemanfaatan luaran lulusan, sesuai target: “RPPL < 20%, PKMTK > 50%, PK2MTK > 70%, rata-rata produk/jasa yang dimanfaatkan masyarakat/DUDIK > 20% program studi aktif, dan sertifikasi kompetensi > 50% dari jumlah lulusan.”',
      },
      {
        kode: 'PTKL-12B',
        judul: 'Analisis dan Evaluasi Capaian Kinerja Luaran',
        uraian:
          'B. PTKL/LPNK menyusun secara sistematis analisis dan evaluasi terhadap capaian kinerja sesuai data PD Dikti yang disesuaikan dengan pilihan fokus diferensiasi misi perguruan tinggi pada bidang pendidikan, atau penelitian dan atau pengabdian kepada masyarakat; analisis harus mencakup identifikasi akar masalah; faktor pendukung keberhasilan dan faktor penghambat ketercapaian.',
        target:
          'PKTJ menyusun analisis dan evaluasi sistematis terhadap capaian kinerja penyelesaian studi dan pemanfaatan luaran sesuai data PD Dikti, mencakup identifikasi akar masalah, faktor pendukung, dan faktor penghambat ketercapaian.',
        satuan: '%',
        strategy:
          'Menyusun laporan analisis dan evaluasi capaian kinerja berbasis data PD Dikti secara sistematis, guna mencapai target: “PKTJ menyusun analisis dan evaluasi sistematis terhadap capaian kinerja penyelesaian studi dan pemanfaatan luaran sesuai data PD Dikti, mencakup identifikasi akar masalah, faktor pendukung, dan faktor penghambat ketercapaian.”',
        buktiSahih:
          'Dokumen analisis dan evaluasi capaian kinerja penyelesaian studi, sesuai target: “PKTJ menyusun analisis dan evaluasi sistematis terhadap capaian kinerja penyelesaian studi dan pemanfaatan luaran sesuai data PD Dikti, mencakup identifikasi akar masalah, faktor pendukung, dan faktor penghambat ketercapaian.”',
      },
      {
        kode: 'PTKL-12C',
        judul: 'Pengukuran Capaian Standar Kompetensi Lulusan',
        uraian:
          'C. PTKL/LPNK melakukan pengukuran terhadap pencapaian standar kompetensi lulusan dalam tiga tahun terakhir minimal mengenai kesatuan kompetensi sikap, keterampilan, dan pengetahuan yang menunjukkan capaian mahasiswa dari hasil pembelajarannya pada akhir program pendidikan tinggi.',
        target:
          'PKTJ melakukan pengukuran capaian standar kompetensi lulusan (sikap, keterampilan, dan pengetahuan) secara berkala dalam tiga tahun terakhir.',
        satuan: '%',
        strategy:
          'Melaksanakan pengukuran capaian standar kompetensi lulusan secara berkala melalui instrumen penilaian sikap, keterampilan, dan pengetahuan, guna mencapai target: “PKTJ melakukan pengukuran capaian standar kompetensi lulusan (sikap, keterampilan, dan pengetahuan) secara berkala dalam tiga tahun terakhir.”',
        buktiSahih:
          'Data dan instrumen pengukuran capaian kompetensi lulusan, sesuai target: “PKTJ melakukan pengukuran capaian standar kompetensi lulusan (sikap, keterampilan, dan pengetahuan) secara berkala dalam tiga tahun terakhir.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-15',
    targetLamaGabungan: "Capaian PTKL/LPNK menunjukkan PPM < 20%, PMAP > 0,01%, dan PLLK > 20%, dengan analisis capaian dampak yang menyeluruh disertai tindak lanjut konkret yang didukung bukti sahih.",
    bagian: [
      {
        kode: 'PTKL-15A',
        judul: 'Evaluasi Penurunan Mahasiswa Baru, Prestasi, dan Keterserapan Lulusan',
        uraian:
          'A. PT melakukan evaluasi dan analisis terhadap aspek berikut: 1) Prosentase penurunan mahasiswa baru (Sarjana, Sarjana Terapan, Diploma Tiga) dalam 3 tahun terakhir (PPM). 2) Persentase keterlibatan mahasiswa aktif dalam memperoleh prestasi mahasiswa tingkat internasional nasional/provinsi peringkat 1, 2 dan 3 saat TS (PMAP). 3) Persentase lulusan terserap lapangan kerja/melanjutkan studi pada jenjang berikutnya/berwirausaha kurang dari sama dengan 1 tahun saat tahun lulusan TS-2 (PLLK).',
        target: 'Capaian PKTJ menunjukkan PPM < 20%, PMAP > 0,01%, dan PLLK > 20%.',
        satuan: '%',
        strategy:
          'Memantau dan mengevaluasi tren penurunan mahasiswa baru, prestasi mahasiswa, dan keterserapan lulusan secara berkala, guna mencapai target: “Capaian PKTJ menunjukkan PPM < 20%, PMAP > 0,01%, dan PLLK > 20%.”',
        buktiSahih:
          'Data dan rekap capaian PPM, PMAP, dan PLLK per tahun, sesuai target: “Capaian PKTJ menunjukkan PPM < 20%, PMAP > 0,01%, dan PLLK > 20%.”',
      },
      {
        kode: 'PTKL-15B',
        judul: 'Analisis Capaian Dampak',
        uraian:
          'B. Analisis Capaian Dampak. Analisis terkait aspek 1 sampai dengan 3 (PPM, PMAP, PLLK) harus mencakup identifikasi akar masalah, faktor pendukung keberhasilan dan faktor penghambat ketercapaian.',
        target:
          'PKTJ menyusun analisis capaian dampak yang menyeluruh atas PPM, PMAP, dan PLLK, mencakup identifikasi akar masalah, faktor pendukung, dan faktor penghambat, disertai tindak lanjut konkret yang didukung bukti sahih.',
        satuan: '%',
        strategy:
          'Menyusun analisis capaian dampak disertai identifikasi akar masalah dan tindak lanjut perbaikan, guna mencapai target: “PKTJ menyusun analisis capaian dampak yang menyeluruh atas PPM, PMAP, dan PLLK, mencakup identifikasi akar masalah, faktor pendukung, dan faktor penghambat, disertai tindak lanjut konkret yang didukung bukti sahih.”',
        buktiSahih:
          'Dokumen analisis capaian dampak dan bukti tindak lanjut konkret, sesuai target: “PKTJ menyusun analisis capaian dampak yang menyeluruh atas PPM, PMAP, dan PLLK, mencakup identifikasi akar masalah, faktor pendukung, dan faktor penghambat, disertai tindak lanjut konkret yang didukung bukti sahih.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-16',
    targetLamaGabungan: "PKTJ memiliki Renstra Penelitian yang komprehensif dan selaras diferensiasi misi dengan target berdampak, serta pedoman penelitian dan pengembangan SDM peneliti yang diterapkan secara berkelanjutan disertai evaluasi kinerja yang jelas.",
    bagian: [
      {
        kode: 'PTKL-16A',
        judul: 'Rencana Strategis Penelitian',
        uraian:
          'A. Perguruan tinggi memiliki dokumen formal Rencana Strategis Penelitian sesuai diferensiasi misi perguruan tingginya serta target berdampak, yang mencakup aspek: 1) Rencana Strategis Penelitian yang memuat landasan pengembangan, sesuai pilihan diferensiasi misi perguruan tingginya yang fokus dalam bidang pendidikan atau penelitian atau PkM. 2) Peta jalan penelitian, sesuai pilihan diferensiasi misi perguruan tingginya. 3) Sumber daya (termasuk penyediaan akses terhadap sarana, prasarana, sumber pendanaan penelitian dan pengembangan, serta penerapan sistem berbasis teknologi informasi dan komunikasi untuk mendokumentasikan, mengevaluasi, melaporkan, dan menyebarluaskan proses dan hasil penelitian). 4) Sasaran program strategis dan indikator kinerja.',
        target:
          'PKTJ memiliki dokumen formal Rencana Strategis Penelitian yang komprehensif dan selaras dengan diferensiasi misi, mencakup landasan pengembangan, peta jalan, sumber daya, serta sasaran program dan indikator kinerja dengan target berdampak.',
        satuan: '%',
        strategy:
          'Menyusun dan menetapkan Rencana Strategis Penelitian selaras diferensiasi misi, mencakup peta jalan, sumber daya, dan indikator kinerja, guna mencapai target: “PKTJ memiliki dokumen formal Rencana Strategis Penelitian yang komprehensif dan selaras dengan diferensiasi misi, mencakup landasan pengembangan, peta jalan, sumber daya, serta sasaran program dan indikator kinerja dengan target berdampak.”',
        buktiSahih:
          'Dokumen Renstra Penelitian beserta peta jalan dan sasaran program, sesuai target: “PKTJ memiliki dokumen formal Rencana Strategis Penelitian yang komprehensif dan selaras dengan diferensiasi misi, mencakup landasan pengembangan, peta jalan, sumber daya, serta sasaran program dan indikator kinerja dengan target berdampak.”',
      },
      {
        kode: 'PTKL-16B',
        judul: 'Pedoman Penelitian dan Pengembangan SDM Peneliti',
        uraian:
          'B. Perguruan tinggi memiliki pedoman penelitian dan program pengembangan sumberdaya manusia peneliti dan perekayasa, penugasan dan peningkatan kompetensi dosen dalam melaksanakan penelitian sesuai bobot yang ditugaskan.',
        target:
          'PKTJ memiliki pedoman penelitian dan program pengembangan SDM peneliti/perekayasa yang diterapkan secara berkelanjutan disertai evaluasi kinerja yang jelas.',
        satuan: '%',
        strategy:
          'Menyusun pedoman penelitian dan program pengembangan SDM peneliti/perekayasa serta melaksanakan evaluasi kinerjanya, guna mencapai target: “PKTJ memiliki pedoman penelitian dan program pengembangan SDM peneliti/perekayasa yang diterapkan secara berkelanjutan disertai evaluasi kinerja yang jelas.”',
        buktiSahih:
          'Dokumen pedoman penelitian dan laporan evaluasi kinerja pengembangan SDM peneliti, sesuai target: “PKTJ memiliki pedoman penelitian dan program pengembangan SDM peneliti/perekayasa yang diterapkan secara berkelanjutan disertai evaluasi kinerja yang jelas.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-17',
    targetLamaGabungan: "PKTJ memiliki pedoman penelitian yang mengatur keenam aspek proses penelitian secara berintegritas, mewujudkan misi PKTJ dengan tata kelola baik (kode etik, HKI, kerja sama, publikasi), dan melakukan evaluasi kesesuaian pelaksanaan penelitian dengan peta jalan.",
    bagian: [
      {
        kode: 'PTKL-17A',
        judul: 'Proses Penelitian yang Berintegritas',
        uraian:
          'A. Perguruan tinggi menyelenggarakan penelitian yang melibatkan dosen, mahasiswa, peneliti, atau kolaborasi antar pihak dengan sistem pengelolaan yang jelas, serta memberikan SKS bagi mahasiswa yang terlibat secara terbimbing. Perguruan tinggi menyelenggarakan proses penelitian yang berintegritas mencakup aspek berikut: 1) tatacara penilaian dan review, 2) legalitas pengangkatan reviewer, 3) hasil penilaian usul penelitian, 4) legalitas penugasan peneliti/kerjasama peneliti, yang melibatkan dosen, mahasiswa, peneliti serta memberikan SKS bagi mahasiswa yang terlibat secara terbimbing, 5) berita acara hasil monitoring dan evaluasi, serta 6) dokumentasi luaran penelitian.',
        target:
          'PKTJ memiliki pedoman penelitian yang mengatur keenam aspek proses penelitian secara berintegritas (tata cara penilaian/review, legalitas reviewer, hasil penilaian usul, legalitas penugasan/kerja sama peneliti, monitoring-evaluasi, dan dokumentasi luaran), melibatkan dosen dan mahasiswa dengan pemberian sks bagi mahasiswa terbimbing.',
        satuan: '%',
        strategy:
          'Menyusun dan menerapkan pedoman proses penelitian yang berintegritas mencakup keenam aspek, melibatkan dosen dan mahasiswa terbimbing, guna mencapai target: “PKTJ memiliki pedoman penelitian yang mengatur keenam aspek proses penelitian secara berintegritas (tata cara penilaian/review, legalitas reviewer, hasil penilaian usul, legalitas penugasan/kerja sama peneliti, monitoring-evaluasi, dan dokumentasi luaran), melibatkan dosen dan mahasiswa dengan pemberian sks bagi mahasiswa terbimbing.”',
        buktiSahih:
          'Dokumen pedoman penelitian, berita acara monitoring-evaluasi, dan dokumentasi luaran penelitian, sesuai target: “PKTJ memiliki pedoman penelitian yang mengatur keenam aspek proses penelitian secara berintegritas (tata cara penilaian/review, legalitas reviewer, hasil penilaian usul, legalitas penugasan/kerja sama peneliti, monitoring-evaluasi, dan dokumentasi luaran), melibatkan dosen dan mahasiswa dengan pemberian sks bagi mahasiswa terbimbing.”',
      },
      {
        kode: 'PTKL-17B',
        judul: 'Tata Kelola dan Evaluasi Pelaksanaan Penelitian',
        uraian:
          'B. Perguruan tinggi menunjukkan pengelolaan penelitian yang terstruktur, ilmiah, etis, dan sesuai tata kelola baik, mewujudkan misi perguruan tingginya serta mendukung pembangunan intelektual, budaya penelitian, dan pengembangan ilmu pengetahuan, dilengkapi kode etik, tata kelola HKI, kerja sama penelitian, dan publikasi hasil penelitian. Melakukan evaluasi pelaksanaan penelitian dengan peta jalan.',
        target:
          'PKTJ menunjukkan pengelolaan penelitian yang terstruktur, ilmiah, etis, dan sesuai tata kelola baik (kode etik, HKI, kerja sama, publikasi), serta melakukan evaluasi kesesuaian pelaksanaan penelitian dengan peta jalan.',
        satuan: '%',
        strategy:
          'Menerapkan tata kelola penelitian yang etis (kode etik, HKI, kerja sama, publikasi) dan mengevaluasi kesesuaiannya dengan peta jalan penelitian, guna mencapai target: “PKTJ menunjukkan pengelolaan penelitian yang terstruktur, ilmiah, etis, dan sesuai tata kelola baik (kode etik, HKI, kerja sama, publikasi), serta melakukan evaluasi kesesuaian pelaksanaan penelitian dengan peta jalan.”',
        buktiSahih:
          'Dokumen kode etik penelitian, tata kelola HKI, kerja sama, dan laporan evaluasi kesesuaian dengan peta jalan, sesuai target: “PKTJ menunjukkan pengelolaan penelitian yang terstruktur, ilmiah, etis, dan sesuai tata kelola baik (kode etik, HKI, kerja sama, publikasi), serta melakukan evaluasi kesesuaian pelaksanaan penelitian dengan peta jalan.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-18',
    targetLamaGabungan: "PKTJ menunjukkan hasil analisis luaran penelitian yang komprehensif mencakup publikasi-HKI-produk/jasa sesuai target berdampak, dengan capaian Rasio Luaran Penelitian (RLP) mencapai 100% atau lebih dari target yang ditetapkan.",
    bagian: [
      {
        kode: 'PTKL-18A',
        judul: 'Analisis Keberlanjutan dan Kemanfaatan Luaran Penelitian',
        uraian:
          'A. Perguruan tinggi menunjukkan hasil analisis terhadap luaran penelitian yang mengadopsi lisensi terbuka, menunjukkan keberlanjutan dan kemanfaatan hasil penelitian sesuai peta jalan, kerjasama yang dilaksanakan, serta realisasi sumber dana penelitian dan pengembangan.',
        target:
          'PKTJ menunjukkan hasil analisis luaran penelitian berlisensi terbuka yang mencakup keberlanjutan dan kemanfaatan hasil penelitian sesuai peta jalan, kerja sama yang dilaksanakan, dan realisasi sumber dana penelitian. (diturunkan dari uraian butir — teks target asli tidak menyebut elemen ini secara eksplisit)',
        satuan: '%',
        strategy:
          'Melakukan analisis keberlanjutan dan kemanfaatan luaran penelitian berlisensi terbuka serta realisasi sumber dana penelitian secara berkala, guna mencapai target: “PKTJ menunjukkan hasil analisis luaran penelitian berlisensi terbuka yang mencakup keberlanjutan dan kemanfaatan hasil penelitian sesuai peta jalan, kerja sama yang dilaksanakan, dan realisasi sumber dana penelitian.”',
        buktiSahih:
          'Dokumen analisis keberlanjutan luaran penelitian, data kerja sama, dan realisasi sumber dana penelitian, sesuai target: “PKTJ menunjukkan hasil analisis luaran penelitian berlisensi terbuka yang mencakup keberlanjutan dan kemanfaatan hasil penelitian sesuai peta jalan, kerja sama yang dilaksanakan, dan realisasi sumber dana penelitian.”',
      },
      {
        kode: 'PTKL-18B',
        judul: 'Ketercapaian Luaran Penelitian sesuai Indikator Kinerja',
        uraian:
          'B. Perguruan tinggi menunjukkan hasil analisis terhadap ketercapaian luaran penelitian sesuai dengan indikator kinerja dan target berdampak yang ditetapkan, sesuai pilihan diferensiasi misi perguruan tingginya yang fokus dalam bidang pendidikan atau penelitian atau pengabdian kepada masyarakat, berupa: a) publikasi, b) Hak Kekayaan Intelektual (HKI) dan c) produk/jasa.',
        target:
          'PKTJ menunjukkan hasil analisis luaran penelitian yang komprehensif mencakup publikasi, HKI, dan produk/jasa sesuai indikator kinerja dan target berdampak yang ditetapkan.',
        satuan: '%',
        strategy:
          'Melakukan analisis ketercapaian luaran penelitian (publikasi, HKI, produk/jasa) terhadap indikator kinerja dan target berdampak, guna mencapai target: “PKTJ menunjukkan hasil analisis luaran penelitian yang komprehensif mencakup publikasi, HKI, dan produk/jasa sesuai indikator kinerja dan target berdampak yang ditetapkan.”',
        buktiSahih:
          'Dokumen analisis ketercapaian luaran penelitian per jenis luaran, sesuai target: “PKTJ menunjukkan hasil analisis luaran penelitian yang komprehensif mencakup publikasi, HKI, dan produk/jasa sesuai indikator kinerja dan target berdampak yang ditetapkan.”',
      },
      {
        kode: 'PTKL-18C',
        judul: 'Rasio Luaran Penelitian Dosen (RLP)',
        uraian:
          'C. Luaran penelitian dan Pengabdian kepada Masyarakat dosen tetap dan/atau mahasiswa dalam 3 tahun saat TS, berupa: 1) Jurnal nasional tidak terakreditasi 2) Jurnal nasional terakreditasi Sinta 1 dan Sinta 2 3) Jurnal internasional 4) Jurnal internasional bereputasi 5) Prosiding Seminar wilayah/lokal/perguruan tinggi 6) Prosiding Seminar nasional 7) Prosiding Seminar internasional 8) Tulisan di media massa nasional 9) Tulisan di media massa internasional. RLP (%) = (NA2 + NA3 + NA4 + NB2 + NB3 + NC2 + NC3) / NDT X 100.',
        target: 'Rasio Luaran Penelitian (RLP) dosen tetap PKTJ mencapai 100% atau lebih dari target yang ditetapkan.',
        satuan: '%',
        strategy:
          'Memantau dan meningkatkan produktivitas publikasi dan luaran penelitian dosen tetap guna memenuhi Rasio Luaran Penelitian (RLP), guna mencapai target: “Rasio Luaran Penelitian (RLP) dosen tetap PKTJ mencapai 100% atau lebih dari target yang ditetapkan.”',
        buktiSahih:
          'Rekap luaran penelitian dosen tetap per jenis publikasi/prosiding dan perhitungan RLP, sesuai target: “Rasio Luaran Penelitian (RLP) dosen tetap PKTJ mencapai 100% atau lebih dari target yang ditetapkan.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-20',
    targetLamaGabungan: "PKTJ memiliki Renstra PkM yang memuat landasan pengembangan, peta jalan, sumber pendanaan, sistem TIK, dan sasaran program dengan target berdampak sesuai diferensiasi misi, serta pedoman PkM dan pengembangan kepakaran yang sesuai rencana pengembangan institusi.",
    bagian: [
      {
        kode: 'PTKL-20A',
        judul: 'Rencana Strategis Pengabdian kepada Masyarakat',
        uraian:
          'A. Perguruan tinggi memiliki Rencana Strategis dan menetapkan peta jalan Pengabdian kepada Masyarakat di tingkat perguruan tinggi sesuai diferensiasi misinya, mencakup aspek: 1) Rencana Strategis Pengabdian kepada Masyarakat memuat landasan pengembangan. 2) Peta jalan Pengabdian kepada Masyarakat. 3) Sumber daya (termasuk penyediaan akses terhadap sarana, prasarana, sumber pendanaan penelitian dan pengembangan, serta penerapan sistem berbasis TIK). 4) Sasaran program strategis dan indikator kinerja sesuai dengan target berdampak yang ditetapkan.',
        target:
          'PKTJ memiliki Renstra Pengabdian kepada Masyarakat yang memuat landasan pengembangan, peta jalan, sumber daya (sarana-prasarana, pendanaan, sistem TIK), serta sasaran program dan indikator kinerja dengan target berdampak sesuai diferensiasi misi.',
        satuan: '%',
        strategy:
          'Menyusun dan menetapkan Rencana Strategis Pengabdian kepada Masyarakat selaras diferensiasi misi, mencakup peta jalan dan sumber daya, guna mencapai target: “PKTJ memiliki Renstra Pengabdian kepada Masyarakat yang memuat landasan pengembangan, peta jalan, sumber daya (sarana-prasarana, pendanaan, sistem TIK), serta sasaran program dan indikator kinerja dengan target berdampak sesuai diferensiasi misi.”',
        buktiSahih:
          'Dokumen Renstra PkM beserta peta jalan dan sasaran program, sesuai target: “PKTJ memiliki Renstra Pengabdian kepada Masyarakat yang memuat landasan pengembangan, peta jalan, sumber daya (sarana-prasarana, pendanaan, sistem TIK), serta sasaran program dan indikator kinerja dengan target berdampak sesuai diferensiasi misi.”',
      },
      {
        kode: 'PTKL-20B',
        judul: 'Pedoman PkM dan Pengembangan Kepakaran',
        uraian:
          'B. Perguruan tinggi memiliki pedoman Pengabdian kepada Masyarakat dan pengembangan kualitas kepakaran sesuai dengan rencana pengembangan kepakaran di tingkat perguruan tinggi sesuai diferensiasi misinya.',
        target:
          'PKTJ memiliki pedoman Pengabdian kepada Masyarakat dan program pengembangan kepakaran yang sesuai dengan rencana pengembangan institusi.',
        satuan: '%',
        strategy:
          'Menyusun pedoman PkM dan program pengembangan kepakaran sesuai rencana pengembangan institusi, guna mencapai target: “PKTJ memiliki pedoman Pengabdian kepada Masyarakat dan program pengembangan kepakaran yang sesuai dengan rencana pengembangan institusi.”',
        buktiSahih:
          'Dokumen pedoman PkM dan program pengembangan kepakaran, sesuai target: “PKTJ memiliki pedoman Pengabdian kepada Masyarakat dan program pengembangan kepakaran yang sesuai dengan rencana pengembangan institusi.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-21',
    targetLamaGabungan: "PKTJ memiliki pedoman PkM yang mengatur keenam aspek proses secara terstruktur, menunjukkan budaya PkM dengan layanan kepakaran yang akuntabel-profesional (bersertifikasi), sesuai peta jalan, dan melakukan evaluasi pelaksanaan serta pengembangan dosen pelaksana.",
    bagian: [
      {
        kode: 'PTKL-21A',
        judul: 'Proses Pengabdian kepada Masyarakat yang Terstruktur',
        uraian:
          'A. Perguruan Tinggi menyelenggarakan proses pengabdian kepada masyarakat yang terstruktur mencakup perencanaan, pelaksanaan, penilaian, pengawasan, dan pengendalian yang selaras dengan misi perguruan tingginya dengan tata kelola baik, dilengkapi kode etik, pengelolaan HKI, kerja sama, serta diseminasi hasil. Proses Pengabdian kepada Masyarakat mencakup 6 aspek berikut: 1) tatacara penilaian dan review, 2) legalitas pengangkatan reviewer, 3) hasil penilaian usul PkM, 4) legalitas penugasan pelaksana PkM/kerjasama PkM, dengan melibatkan dosen, dosen-mahasiswa, atau mahasiswa terbimbing dengan pengakuan SKS, 5) berita acara hasil monitoring dan evaluasi, serta 6) dokumentasi luaran PkM.',
        target:
          'PKTJ memiliki pedoman PkM yang mengatur keenam aspek proses secara terstruktur (tata cara penilaian/review, legalitas reviewer, hasil penilaian usul, legalitas penugasan/kerja sama, monitoring-evaluasi, dokumentasi luaran), melibatkan dosen dan mahasiswa terbimbing dengan pemberian sks.',
        satuan: '%',
        strategy:
          'Menyusun dan menerapkan pedoman proses PkM yang terstruktur mencakup keenam aspek, melibatkan dosen dan mahasiswa terbimbing, guna mencapai target: “PKTJ memiliki pedoman PkM yang mengatur keenam aspek proses secara terstruktur (tata cara penilaian/review, legalitas reviewer, hasil penilaian usul, legalitas penugasan/kerja sama, monitoring-evaluasi, dokumentasi luaran), melibatkan dosen dan mahasiswa terbimbing dengan pemberian sks.”',
        buktiSahih:
          'Dokumen pedoman PkM, berita acara monitoring-evaluasi, dan dokumentasi luaran PkM, sesuai target: “PKTJ memiliki pedoman PkM yang mengatur keenam aspek proses secara terstruktur (tata cara penilaian/review, legalitas reviewer, hasil penilaian usul, legalitas penugasan/kerja sama, monitoring-evaluasi, dokumentasi luaran), melibatkan dosen dan mahasiswa terbimbing dengan pemberian sks.”',
      },
      {
        kode: 'PTKL-21B',
        judul: 'Budaya dan Layanan Kepakaran Pengabdian kepada Masyarakat',
        uraian:
          'B. Perguruan tinggi menunjukkan budaya Pengabdian kepada Masyarakat, menyelenggarakan layanan kepakaran yang akuntabel dan profesional (sertifikasi/lisensi individu/lembaga), menunjukkan kesesuaian dengan peta jalan dan melakukan evaluasi pelaksanaan serta pengembangan dosen pelaksana pengabdian.',
        target:
          'PKTJ menunjukkan budaya Pengabdian kepada Masyarakat dengan layanan kepakaran yang akuntabel dan profesional (bersertifikasi/berlisensi), sesuai peta jalan, disertai evaluasi pelaksanaan dan pengembangan dosen pelaksana.',
        satuan: '%',
        strategy:
          'Mengembangkan budaya PkM dan layanan kepakaran yang akuntabel-profesional sesuai peta jalan, disertai evaluasi dan pengembangan dosen pelaksana, guna mencapai target: “PKTJ menunjukkan budaya Pengabdian kepada Masyarakat dengan layanan kepakaran yang akuntabel dan profesional (bersertifikasi/berlisensi), sesuai peta jalan, disertai evaluasi pelaksanaan dan pengembangan dosen pelaksana.”',
        buktiSahih:
          'Bukti sertifikasi/lisensi layanan kepakaran, laporan evaluasi pelaksanaan PkM, dan bukti pengembangan dosen pelaksana, sesuai target: “PKTJ menunjukkan budaya Pengabdian kepada Masyarakat dengan layanan kepakaran yang akuntabel dan profesional (bersertifikasi/berlisensi), sesuai peta jalan, disertai evaluasi pelaksanaan dan pengembangan dosen pelaksana.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-22',
    targetLamaGabungan: "PKTJ menunjukkan hasil analisis luaran PkM yang mendukung pencapaian misi institusi sesuai fokus diferensiasi misi dan target berdampak yang ditetapkan.",
    bagian: [
      {
        kode: 'PTKL-22A',
        judul: 'Analisis Mutu, Relevansi, dan Kemanfaatan Luaran PkM',
        uraian:
          'A. Perguruan tinggi menunjukkan hasil Pengabdian kepada Masyarakat yang memiliki mutu, relevansi, dan kemanfaatan yang memenuhi kriteria minimal, mendukung pencapaian misi perguruan tingginya yang disebarluaskan melalui lisensi terbuka atau mekanisme akses publik yang luas, khususnya untuk kegiatan yang dibiayai pemerintah. Melakukan analisis terhadap ketercapaian luaran Pengabdian kepada Masyarakat yang menganut lisensi terbuka, pengembangan kapasitas termasuk sumber daya manusia, keterlaksanaan ragam layanan terlembaga, kerjasama yang dilaksanakan, serta realisasi sumber dana pengabdian dan pengembangan.',
        target:
          'PKTJ menunjukkan hasil analisis luaran PkM yang bermutu, relevan, dan bermanfaat, disebarluaskan melalui lisensi terbuka/akses publik, mencakup pengembangan kapasitas SDM, keterlaksanaan layanan terlembaga, kerja sama, dan realisasi sumber dana pengabdian.',
        satuan: '%',
        strategy:
          'Melakukan analisis mutu, relevansi, dan kemanfaatan luaran PkM serta menyebarluaskannya melalui lisensi terbuka, guna mencapai target: “PKTJ menunjukkan hasil analisis luaran PkM yang bermutu, relevan, dan bermanfaat, disebarluaskan melalui lisensi terbuka/akses publik, mencakup pengembangan kapasitas SDM, keterlaksanaan layanan terlembaga, kerja sama, dan realisasi sumber dana pengabdian.”',
        buktiSahih:
          'Dokumen analisis mutu-relevansi-kemanfaatan luaran PkM dan bukti diseminasi lisensi terbuka, sesuai target: “PKTJ menunjukkan hasil analisis luaran PkM yang bermutu, relevan, dan bermanfaat, disebarluaskan melalui lisensi terbuka/akses publik, mencakup pengembangan kapasitas SDM, keterlaksanaan layanan terlembaga, kerja sama, dan realisasi sumber dana pengabdian.”',
      },
      {
        kode: 'PTKL-22B',
        judul: 'Analisis Rekognisi Luaran PkM sesuai Diferensiasi Misi',
        uraian:
          'B. Perguruan tinggi menunjukkan hasil analisis terhadap luaran Pengabdian kepada Masyarakat sesuai pilihan diferensiasi misi perguruan tingginya yang fokus dalam bidang pendidikan atau penelitian atau Pengabdian kepada Masyarakat, berupa rekognisi sesuai bidang keilmuan.',
        target:
          'PKTJ menunjukkan hasil analisis luaran PkM berupa rekognisi sesuai bidang keilmuan yang mendukung pencapaian misi institusi sesuai fokus diferensiasi misi dan target berdampak yang ditetapkan.',
        satuan: '%',
        strategy:
          'Melakukan analisis rekognisi luaran PkM sesuai bidang keilmuan dan fokus diferensiasi misi, guna mencapai target: “PKTJ menunjukkan hasil analisis luaran PkM berupa rekognisi sesuai bidang keilmuan yang mendukung pencapaian misi institusi sesuai fokus diferensiasi misi dan target berdampak yang ditetapkan.”',
        buktiSahih:
          'Dokumen analisis rekognisi luaran PkM sesuai bidang keilmuan, sesuai target: “PKTJ menunjukkan hasil analisis luaran PkM berupa rekognisi sesuai bidang keilmuan yang mendukung pencapaian misi institusi sesuai fokus diferensiasi misi dan target berdampak yang ditetapkan.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-23',
    targetLamaGabungan: "PKTJ memperoleh pengakuan kepakaran profesional sesuai target berdampak, dengan capaian Rasio Rekognisi Dosen (RRD) dan Rasio HKI (RHKI) mencapai 100% atau lebih dari target yang ditetapkan.",
    bagian: [
      {
        kode: 'PTKL-23A',
        judul: 'Pengakuan Kepakaran Profesional Dosen',
        uraian:
          'A. Perguruan tinggi mendapatkan pengakuan kepakaran profesional baik secara individu maupun lembaga dari masyarakat, pemerintah dan industri berupa jasa Dosen Tetap.',
        target:
          'PKTJ memperoleh pengakuan kepakaran profesional dosen tetap, baik secara individu maupun lembaga, dari masyarakat, pemerintah, dan industri, sesuai target berdampak yang ditetapkan.',
        satuan: '%',
        strategy:
          'Mendorong dan memfasilitasi dosen tetap memperoleh pengakuan kepakaran profesional dari masyarakat, pemerintah, dan industri, guna mencapai target: “PKTJ memperoleh pengakuan kepakaran profesional dosen tetap, baik secara individu maupun lembaga, dari masyarakat, pemerintah, dan industri, sesuai target berdampak yang ditetapkan.”',
        buktiSahih:
          'Dokumen/sertifikat pengakuan kepakaran profesional dosen tetap dari lembaga eksternal, sesuai target: “PKTJ memperoleh pengakuan kepakaran profesional dosen tetap, baik secara individu maupun lembaga, dari masyarakat, pemerintah, dan industri, sesuai target berdampak yang ditetapkan.”',
      },
      {
        kode: 'PTKL-23B',
        judul: 'Rasio Rekognisi Dosen (RRD) dan Rasio HKI (RHKI)',
        uraian:
          'B. Karya dosen tetap dan/atau mahasiswa yang terekognisi/diterapkan masyarakat, berupa: HKI: Paten/Paten Sederhana, Hak Cipta, Desain Produk Industri, Perlindungan Varietas Tanaman, Desain Tata Letak Sirkuit Terpadu, dll. RRD (%) = NRD / NDT X 100. NRD = Jumlah dosen yang mendapat pengakuan atas prestasi/kinerja dalam 3 tahun terakhir. NDT = Jumlah dosen tetap. RHKI (%) = (NA + NB + NC) / NDT X 100.',
        target: 'Rasio Rekognisi Dosen (RRD) dan Rasio HKI (RHKI) PKTJ mencapai 100% atau lebih dari target yang ditetapkan.',
        satuan: '%',
        strategy:
          'Memantau dan meningkatkan karya dosen tetap yang terekognisi/diterapkan masyarakat (HKI dan rekognisi lainnya) guna memenuhi RRD dan RHKI, guna mencapai target: “Rasio Rekognisi Dosen (RRD) dan Rasio HKI (RHKI) PKTJ mencapai 100% atau lebih dari target yang ditetapkan.”',
        buktiSahih:
          'Rekap karya dosen tetap terekognisi (HKI, rekognisi individu/lembaga) dan perhitungan RRD/RHKI, sesuai target: “Rasio Rekognisi Dosen (RRD) dan Rasio HKI (RHKI) PKTJ mencapai 100% atau lebih dari target yang ditetapkan.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-27',
    targetLamaGabungan: "PKTJ memiliki dokumen formal rencana anggaran tahunan dan rencana jangka 5 tahunan yang ditetapkan resmi dan dilaksanakan konsisten, dengan sumber dana di luar mahasiswa minimal 10% dari total penerimaan, disertai kebijakan bantuan biaya pendidikan yang diterapkan konsisten bagi mahasiswa kurang mampu.",
    bagian: [
      {
        kode: 'PTKL-27A',
        judul: 'Rencana Strategis Keuangan dan Sumber Dana di Luar Mahasiswa',
        uraian:
          'A. Rencana strategi Keuangan, sistem pengelolaan dan sumber dana. Sumber dana di luar mahasiswa mencakup: a. Pendapatan dari riset dan inovasi: hibah riset nasional/internasional, kontrak riset dengan industri, royalti dari paten/hak cipta/teknologi tepat guna, hasil komersialisasi inovasi, pendapatan dari inkubasi bisnis/startup berbasis riset. b. Pendapatan dari kerja sama dan layanan: jasa konsultasi, pelatihan/sertifikasi profesi, kerja sama internasional, layanan profesional. c. Pendapatan dari usaha dan unit bisnis perguruan tinggi. Tidak termasuk SPP/UKT, subsidi langsung pemerintah, dan sumbangan/filantropi di luar laporan keuangan resmi.',
        target:
          'PKTJ memiliki dokumen formal rencana anggaran tahunan dan rencana jangka 5 tahunan yang ditetapkan resmi dan dilaksanakan konsisten, dengan sumber dana di luar mahasiswa minimal 10% dari total penerimaan.',
        satuan: '%',
        strategy:
          'Menyusun rencana anggaran tahunan dan rencana jangka 5 tahunan serta mengembangkan sumber dana di luar mahasiswa (riset, kerja sama, unit usaha), guna mencapai target: “PKTJ memiliki dokumen formal rencana anggaran tahunan dan rencana jangka 5 tahunan yang ditetapkan resmi dan dilaksanakan konsisten, dengan sumber dana di luar mahasiswa minimal 10% dari total penerimaan.”',
        buktiSahih:
          'Dokumen rencana anggaran tahunan/5 tahunan dan laporan realisasi sumber dana di luar mahasiswa, sesuai target: “PKTJ memiliki dokumen formal rencana anggaran tahunan dan rencana jangka 5 tahunan yang ditetapkan resmi dan dilaksanakan konsisten, dengan sumber dana di luar mahasiswa minimal 10% dari total penerimaan.”',
      },
      {
        kode: 'PTKL-27B',
        judul: 'Kebijakan Pendanaan Mahasiswa Kurang Mampu',
        uraian: 'B. Kebijakan pendanaan untuk kelompok mahasiswa yang kurang beruntung.',
        target:
          'PKTJ memiliki dan menerapkan secara konsisten kebijakan bantuan biaya pendidikan bagi kelompok mahasiswa yang kurang beruntung/kurang mampu.',
        satuan: '%',
        strategy:
          'Menyusun dan menerapkan kebijakan bantuan biaya pendidikan bagi mahasiswa kurang mampu secara konsisten, guna mencapai target: “PKTJ memiliki dan menerapkan secara konsisten kebijakan bantuan biaya pendidikan bagi kelompok mahasiswa yang kurang beruntung/kurang mampu.”',
        buktiSahih:
          'Dokumen kebijakan dan data penerima bantuan biaya pendidikan mahasiswa kurang mampu, sesuai target: “PKTJ memiliki dan menerapkan secara konsisten kebijakan bantuan biaya pendidikan bagi kelompok mahasiswa yang kurang beruntung/kurang mampu.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-28',
    targetLamaGabungan: "PKTJ memiliki dokumen formal pengembangan GUG yang lengkap dan memenuhi aspek legal serta bukti sahih penyelenggaraan praktik baik GUG mencakup keenam aspek secara konsisten, disertai keberfungsian penegakan kode etik dan pengumuman ringkasan laporan tahunan kepada masyarakat.",
    bagian: [
      {
        kode: 'PTKL-28A',
        judul: 'Praktik Baik Good University Governance (GUG)',
        uraian:
          'Praktik baik perwujudan Good University Governance (GUG) termasuk penanggulangan dan penindakan terhadap kekerasan seksual, perundungan, dan intoleransi yang terjadi di internal Perguruan Tinggi. A. Ketersediaan bukti yang sahih terkait praktik baik perwujudan GUG paling tidak mencakup aspek berikut: 1. kredibilitas, 2. transparansi, 3. akuntabilitas, 4. tanggung jawab, 5. keadilan, dan 6. manajemen risiko.',
        target:
          'PKTJ memiliki dokumen formal pengembangan GUG yang lengkap dan memenuhi aspek legal, serta bukti sahih penyelenggaraan praktik baik GUG mencakup keenam aspek (kredibilitas, transparansi, akuntabilitas, tanggung jawab, keadilan, manajemen risiko) secara konsisten, disertai pengumuman ringkasan laporan tahunan kepada masyarakat.',
        satuan: '%',
        strategy:
          'Menerapkan dan mendokumentasikan praktik baik GUG mencakup keenam aspek serta mempublikasikan ringkasan laporan tahunan kepada masyarakat, guna mencapai target: “PKTJ memiliki dokumen formal pengembangan GUG yang lengkap dan memenuhi aspek legal, serta bukti sahih penyelenggaraan praktik baik GUG mencakup keenam aspek (kredibilitas, transparansi, akuntabilitas, tanggung jawab, keadilan, manajemen risiko) secara konsisten, disertai pengumuman ringkasan laporan tahunan kepada masyarakat.”',
        buktiSahih:
          'Dokumen formal pengembangan GUG dan bukti sahih pelaksanaan keenam aspek GUG, sesuai target: “PKTJ memiliki dokumen formal pengembangan GUG yang lengkap dan memenuhi aspek legal, serta bukti sahih penyelenggaraan praktik baik GUG mencakup keenam aspek (kredibilitas, transparansi, akuntabilitas, tanggung jawab, keadilan, manajemen risiko) secara konsisten, disertai pengumuman ringkasan laporan tahunan kepada masyarakat.”',
      },
      {
        kode: 'PTKL-28B',
        judul: 'Lembaga Penegakan Kode Etik',
        uraian:
          'B. Keberadaan dan keberfungsian lembaga/fungsi penegakan kode etik untuk menjamin tata nilai dan integritas, termasuk penanggulangan dan penindakan terhadap kekerasan seksual, perundungan, dan intoleransi yang terjadi di internal Perguruan Tinggi.',
        target:
          'PKTJ memiliki lembaga/fungsi penegakan kode etik yang berfungsi efektif untuk menjamin tata nilai dan integritas, termasuk penanganan kekerasan seksual, perundungan, dan intoleransi.',
        satuan: '%',
        strategy:
          'Membentuk dan mengoperasikan lembaga/fungsi penegakan kode etik termasuk penanganan kekerasan seksual, perundungan, dan intoleransi, guna mencapai target: “PKTJ memiliki lembaga/fungsi penegakan kode etik yang berfungsi efektif untuk menjamin tata nilai dan integritas, termasuk penanganan kekerasan seksual, perundungan, dan intoleransi.”',
        buktiSahih:
          'SK pembentukan dan laporan kinerja lembaga/fungsi penegakan kode etik, sesuai target: “PKTJ memiliki lembaga/fungsi penegakan kode etik yang berfungsi efektif untuk menjamin tata nilai dan integritas, termasuk penanganan kekerasan seksual, perundungan, dan intoleransi.”',
      },
      {
        kode: 'PTKL-28C',
        judul: 'Penjaminan Keamanan, Kenyamanan, dan Kesejahteraan Sivitas Akademika',
        uraian: 'C. Penjaminan keamanan, kenyamanan, dan kesejahteraan hidup sivitas akademika.',
        target:
          'PKTJ menjamin keamanan, kenyamanan, dan kesejahteraan hidup sivitas akademika secara konsisten. (diturunkan dari uraian butir — teks target asli tidak menyebut elemen ini secara eksplisit)',
        satuan: '%',
        strategy:
          'Menerapkan kebijakan dan langkah penjaminan keamanan, kenyamanan, dan kesejahteraan sivitas akademika, guna mencapai target: “PKTJ menjamin keamanan, kenyamanan, dan kesejahteraan hidup sivitas akademika secara konsisten.”',
        buktiSahih:
          'Dokumen kebijakan dan bukti pelaksanaan penjaminan keamanan-kenyamanan-kesejahteraan sivitas akademika, sesuai target: “PKTJ menjamin keamanan, kenyamanan, dan kesejahteraan hidup sivitas akademika secara konsisten.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-29',
    targetLamaGabungan: "PKTJ memiliki bukti formal keberfungsian sistem pengelolaan yang mencakup kelima aspek manajemen dan kesebelas bidang pedoman pengelolaan, serta berjalan secara konsisten.",
    bagian: [
      {
        kode: 'PTKL-29A',
        judul: 'Keberfungsian 5 Aspek Manajemen (POSLC)',
        uraian:
          'Keberfungsian sistem pengelolaan fungsional dan operasional perguruan tinggi. A. Ketersediaan bukti formal keberfungsian sistem pengelolaan fungsional dan operasional perguruan tinggi yang mencakup 5 aspek sebagai berikut: 1) perencanaan (planning), 2) pengorganisasian (organizing), 3) penempatan personil (staffing), 4) pengarahan (leading), dan 5) pengawasan (controlling).',
        target:
          'PKTJ memiliki bukti formal keberfungsian sistem pengelolaan fungsional dan operasional mencakup kelima aspek manajemen (perencanaan, pengorganisasian, penempatan personil, pengarahan, dan pengawasan) yang berjalan secara konsisten.',
        satuan: '%',
        strategy:
          'Menerapkan sistem pengelolaan fungsional dan operasional mencakup kelima aspek manajemen (POSLC) secara konsisten, guna mencapai target: “PKTJ memiliki bukti formal keberfungsian sistem pengelolaan fungsional dan operasional mencakup kelima aspek manajemen (perencanaan, pengorganisasian, penempatan personil, pengarahan, dan pengawasan) yang berjalan secara konsisten.”',
        buktiSahih:
          'Dokumen dan bukti formal keberfungsian kelima aspek manajemen (perencanaan, pengorganisasian, penempatan personil, pengarahan, pengawasan), sesuai target: “PKTJ memiliki bukti formal keberfungsian sistem pengelolaan fungsional dan operasional mencakup kelima aspek manajemen (perencanaan, pengorganisasian, penempatan personil, pengarahan, dan pengawasan) yang berjalan secara konsisten.”',
      },
      {
        kode: 'PTKL-29B',
        judul: 'Pedoman Pengelolaan 11 Bidang',
        uraian:
          'B. Ketersediaan dokumen formal dan pedoman pengelolaan mencakup 11 aspek berikut serta keterlaksanaannya: 1) pendidikan, 2) pengembangan suasana akademik dan otonomi keilmuan, 3) kemahasiswaan, 4) penelitian, 5) PkM, 6) SDM, 7) keuangan, 8) sarana dan prasarana, 9) sistem informasi, 10) sistem penjaminan mutu, dan 11) kerjasama.',
        target:
          'PKTJ memiliki dokumen formal dan pedoman pengelolaan yang mencakup kesebelas bidang (pendidikan, suasana akademik, kemahasiswaan, penelitian, PkM, SDM, keuangan, sarana-prasarana, sistem informasi, penjaminan mutu, dan kerja sama) serta terlaksana secara konsisten.',
        satuan: '%',
        strategy:
          'Menyusun dan menerapkan pedoman pengelolaan yang mencakup kesebelas bidang secara konsisten, guna mencapai target: “PKTJ memiliki dokumen formal dan pedoman pengelolaan yang mencakup kesebelas bidang (pendidikan, suasana akademik, kemahasiswaan, penelitian, PkM, SDM, keuangan, sarana-prasarana, sistem informasi, penjaminan mutu, dan kerja sama) serta terlaksana secara konsisten.”',
        buktiSahih:
          'Dokumen pedoman pengelolaan sebelas bidang beserta bukti keterlaksanaannya, sesuai target: “PKTJ memiliki dokumen formal dan pedoman pengelolaan yang mencakup kesebelas bidang (pendidikan, suasana akademik, kemahasiswaan, penelitian, PkM, SDM, keuangan, sarana-prasarana, sistem informasi, penjaminan mutu, dan kerja sama) serta terlaksana secara konsisten.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-31',
    targetLamaGabungan: "PKTJ memiliki kebijakan penerimaan mahasiswa baru yang lengkap dan diimplementasikan secara konsisten, serta bukti sahih upaya konsisten memperluas akses calon mahasiswa mencakup keempat unsur (PJJ, sharing sumber daya, beasiswa, RPL) dengan hasil yang efektif.",
    bagian: [
      {
        kode: 'PTKL-31A',
        judul: 'Kebijakan Penerimaan Mahasiswa Baru yang Afirmatif, Inklusif, dan Adil',
        uraian:
          'A. Kebijakan penerimaan mahasiswa baru yang lengkap yang mencakup penerimaan mahasiswa baru yang afirmatif, Inklusif dan adil (memperhatikan mahasiswa yang kurang mampu secara ekonomi, tidak membedakan suku, ras, agama, golongan, asal wilayah dan disabilitas).',
        target:
          'PKTJ memiliki kebijakan penerimaan mahasiswa baru yang lengkap, afirmatif, inklusif, dan adil, serta diimplementasikan secara konsisten.',
        satuan: '%',
        strategy:
          'Menyusun dan menerapkan kebijakan penerimaan mahasiswa baru yang afirmatif, inklusif, dan adil secara konsisten, guna mencapai target: “PKTJ memiliki kebijakan penerimaan mahasiswa baru yang lengkap, afirmatif, inklusif, dan adil, serta diimplementasikan secara konsisten.”',
        buktiSahih:
          'Dokumen kebijakan penerimaan mahasiswa baru dan bukti implementasinya, sesuai target: “PKTJ memiliki kebijakan penerimaan mahasiswa baru yang lengkap, afirmatif, inklusif, dan adil, serta diimplementasikan secara konsisten.”',
      },
      {
        kode: 'PTKL-31B',
        judul: 'Perluasan Akses Calon Mahasiswa',
        uraian:
          'B. Perguruan tinggi berupaya memperluas akses calon mahasiswa dengan cara: 1) Pembelajaran jarak jauh (PJJ); 2) Sharing sumberdaya pembelajaran; 3) Beasiswa: afirmasi, 3T, mahasiswa berprestasi tapi tidak mampu, berdasarkan minat dan bakat, berprestasi tinggi; 4) Kebijakan rekrutmen melalui RPL.',
        target:
          'PKTJ memiliki bukti sahih upaya konsisten memperluas akses calon mahasiswa mencakup keempat unsur (pembelajaran jarak jauh, sharing sumber daya pembelajaran, beasiswa, dan rekrutmen melalui RPL) dengan hasil yang efektif.',
        satuan: '%',
        strategy:
          'Melaksanakan program perluasan akses calon mahasiswa melalui PJJ, sharing sumber daya, beasiswa, dan jalur RPL, guna mencapai target: “PKTJ memiliki bukti sahih upaya konsisten memperluas akses calon mahasiswa mencakup keempat unsur (pembelajaran jarak jauh, sharing sumber daya pembelajaran, beasiswa, dan rekrutmen melalui RPL) dengan hasil yang efektif.”',
        buktiSahih:
          'Data dan bukti pelaksanaan PJJ, sharing sumber daya, penerima beasiswa, dan rekrutmen RPL, sesuai target: “PKTJ memiliki bukti sahih upaya konsisten memperluas akses calon mahasiswa mencakup keempat unsur (pembelajaran jarak jauh, sharing sumber daya pembelajaran, beasiswa, dan rekrutmen melalui RPL) dengan hasil yang efektif.”',
      },
    ],
  },
  {
    kodeAsli: 'PTKL-36',
    targetLamaGabungan: "Perguruan tinggi memiliki diferensiasi misi yang jelas dan terukur serta rencana pengembangan institusi yang komprehensif dan relevan dengan pelaksanaan diferensiasi misi (syarat perlu status Terakreditasi Unggul).",
    bagian: [
      {
        kode: 'PTKL-36A',
        judul: 'Diferensiasi Misi yang Jelas dan Realistis',
        uraian:
          'A. Perguruan tinggi memiliki diferensiasi misi yang jelas dan realistis. 1) menunjukkan diferensiasi dan fokus pengembangan yang menegaskan keunggulan khas PT sesuai mandat pendirian dan terlibat dalam agenda wilayah/nasional/internasional sesuai keunggulan PT. 2) dilengkapi dengan visi dan tujuan yang terukur, jelas dan relevan. 3) didukung sumber daya yang memadai dan berkesesuaian langsung dengan keunggulan khas PT. 4) menunjukkan bukti nyata daya saing/keunggulan skala regional/nasional dan/atau internasional sesuai fokus misi. (Syarat Perlu Terakreditasi Unggul)',
        target:
          'PKTJ memiliki diferensiasi misi yang jelas dan terukur, didukung sumber daya yang memadai serta bukti nyata daya saing/keunggulan skala regional/nasional/internasional sesuai fokus misi (syarat perlu status Terakreditasi Unggul).',
        satuan: '%',
        strategy:
          'Merumuskan dan menguatkan diferensiasi misi yang jelas, terukur, dan didukung sumber daya memadai untuk mencapai daya saing sesuai fokus misi, guna mencapai target: “PKTJ memiliki diferensiasi misi yang jelas dan terukur, didukung sumber daya yang memadai serta bukti nyata daya saing/keunggulan skala regional/nasional/internasional sesuai fokus misi (syarat perlu status Terakreditasi Unggul).”',
        buktiSahih:
          'Dokumen penetapan diferensiasi misi beserta bukti daya saing/keunggulan sesuai fokus misi, sesuai target: “PKTJ memiliki diferensiasi misi yang jelas dan terukur, didukung sumber daya yang memadai serta bukti nyata daya saing/keunggulan skala regional/nasional/internasional sesuai fokus misi (syarat perlu status Terakreditasi Unggul).”',
      },
      {
        kode: 'PTKL-36B',
        judul: 'Rencana Pengembangan Institusi',
        uraian:
          'B. Perguruan tinggi merumuskan rencana pengembangan institusi yang mencakup aspek berikut: 1) menunjukkan peta pengembangan jangka panjang dengan roadmap dan milestone yang jelas yang berorientasi pada penguatan kapasitas sektoral, program prioritas K/L, dan integrasi riset dengan kebijakan kementerian. 2) mencakup pengembangan tridharma perguruan tinggi sesuai fokus misi dan pengembangan sumberdaya (sarana prasarana, SDM, keuangan, tata kelola dan penjaminan mutu, kerjasama, dan mahasiswa). 3) dilakukan peninjauan secara berkala untuk mengakomodasi potensi risiko karena perubahan internal dan eksternal. 4) secara konsisten menjadi rujukan dalam pengembangan UPPS/unit kerja di seluruh institusi.',
        target:
          'PKTJ memiliki rencana pengembangan institusi yang komprehensif dan relevan dengan pelaksanaan diferensiasi misi, mencakup roadmap dan milestone jangka panjang, pengembangan tridharma dan sumber daya, serta peninjauan berkala (syarat perlu status Terakreditasi Unggul).',
        satuan: '%',
        strategy:
          'Menyusun dan meninjau secara berkala rencana pengembangan institusi (roadmap, milestone, pengembangan tridharma dan sumber daya), guna mencapai target: “PKTJ memiliki rencana pengembangan institusi yang komprehensif dan relevan dengan pelaksanaan diferensiasi misi, mencakup roadmap dan milestone jangka panjang, pengembangan tridharma dan sumber daya, serta peninjauan berkala (syarat perlu status Terakreditasi Unggul).”',
        buktiSahih:
          'Dokumen rencana pengembangan institusi beserta bukti peninjauan berkala, sesuai target: “PKTJ memiliki rencana pengembangan institusi yang komprehensif dan relevan dengan pelaksanaan diferensiasi misi, mencakup roadmap dan milestone jangka panjang, pengembangan tridharma dan sumber daya, serta peninjauan berkala (syarat perlu status Terakreditasi Unggul).”',
      },
    ],
  },
];
