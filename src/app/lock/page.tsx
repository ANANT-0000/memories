import { redirect } from "next/navigation";

// /lock is no longer needed — the PIN screen lives on the home page via GalleryContainer.
// Redirect any old bookmarks or links to /.
export default function LockPage() {
  redirect("/");
}
