import GalleryView from "@/components/GalleryView";

export default function Home() {
  return (
    <main>
      {/* SEO-friendly hidden content for crawlers */}
      <div className="sr-only">
        <h1>My memory for you</h1>
        <p>
          Welcome to "My memory for you", a secure and private photo gallery.
          This gallery is PIN-protected to ensure memories remain safe and exclusive.
        </p>
      </div>
      <GalleryView />
    </main>
  );
}
