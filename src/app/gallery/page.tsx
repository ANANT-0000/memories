import { redirect } from "next/navigation";

// /gallery is no longer a separate route — everything lives on the home page.
// Redirect any old bookmarks or links to /.
export default function GalleryPage() {
  redirect("/");
}
