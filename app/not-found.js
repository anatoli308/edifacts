// app/not-found.js
import CustomErrorPage from "@/app/_components/CustomErrorPage";

export default function NotFound() {
    return (
        <CustomErrorPage statusCode={404} />
    );
}
