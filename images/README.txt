================================================================
  PLOTYS - SLOŽKA OBRÁZKŮ
  Návod pro přidávání vlastních fotek
================================================================

STRUKTURA SLOŽEK:
─────────────────────────────────────────────────────────────────

📁 images/
   📁 hero/              ← Velké úvodní fotky (slider na hlavní stránce)
       hero-1-dratene.jpg    1920x1080px doporučeno
       hero-2-drevene.jpg    1920x1080px
       hero-3-ploty.jpg      1920x1080px
       hero-4-stavba.jpg     1920x1080px

   📁 categories/        ← Obrázky kategorií produktů (6 kategorií)
       cat-dratene.jpg       800x600px - drátěné ploty
       cat-betonove.jpg      800x600px - betonové ploty
       cat-drevene.jpg       800x600px - dřevěné ploty
       cat-mobilni.jpg       800x600px - mobilní oplocení
       cat-brany.jpg         800x600px - brány a branky
       cat-prislusenstvi.jpg 800x600px - příslušenství

   📁 products/          ← Fotky jednotlivých produktů (e-shop)
       prod-1.jpg, prod-2.jpg ... (číslované podle ID v database.json)
       Doporučená velikost: 600x600px (čtverec)

   📁 gallery/           ← Fotky realizací (sekce Galerie)
       gallery-1.jpg, gallery-2.jpg ...
       Doporučená velikost: 1200x800px

   📁 about/             ← Obrázky pro sekci O nás (mapa, fotka prodejny)
       about-mapa.jpg        Mapa polohy prodejny
       about-shop.jpg        Fotka prodejny (přidejte vlastní)


─────────────────────────────────────────────────────────────────
JAK PŘIDAT NOVÝ OBRÁZEK:
─────────────────────────────────────────────────────────────────

1) Připravte si fotku:
   - Formát: JPG nebo PNG (JPG je menší, lepší pro fotky)
   - Doporučené velikosti viz výše
   - Maximální velikost souboru: 500 KB (pro rychlé načítání)

2) Pojmenujte podle pravidel:
   ✓ Pouze malá písmena, čísla, pomlčky
   ✗ Žádné mezery, diakritika, speciální znaky
   Příklad: "moje-fotka-plotu.jpg" - ANO
            "Můj plot 1.jpg" - NE

3) Přetáhněte do správné složky podle typu

4) Aktualizujte images.json pokud měníte celé sady (volitelné)

─────────────────────────────────────────────────────────────────
MAPOVÁNÍ PRODUKTŮ NA OBRÁZKY:
─────────────────────────────────────────────────────────────────

Každý produkt v database.json má pole "image". Můžete:
- Nechat prázdné: zobrazí se ikonka + barva
- Vyplnit: "products/prod-1.jpg" - cesta od složky images/

Příklad v database.json:
  { "id": 1, "name": "...", "image": "products/prod-pletivo.jpg" }

─────────────────────────────────────────────────────────────────
FALLBACK SYSTÉM:
─────────────────────────────────────────────────────────────────

Pokud obrázek chybí, web automaticky zobrazí:
- Gradientní pozadí v barvě kategorie
- Velkou ikonu produktu (emoji)
- Web nikdy nezobrazí "rozbitý obrázek"

Takže můžete obrázky přidávat postupně - web bude fungovat
i bez nich.

================================================================
