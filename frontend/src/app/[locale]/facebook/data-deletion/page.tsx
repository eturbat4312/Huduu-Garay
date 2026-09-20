import Link from "next/link";

export default function FacebookDataDeletionPage() {
  return <main className="mx-auto max-w-2xl space-y-6 px-6 py-12 text-gray-800">
    <h1 className="text-2xl font-bold">Facebook мэдээллээ устгуулах</h1>
    <p>Танайд Хоноё дахь Facebook холболтоо салгуулах, Facebook-ээс авсан мэдээллээ эсвэл аккаунтаа устгуулах хүсэлт гаргах боломжтой.</p>
    <ol className="list-decimal space-y-3 pl-5">
      <li>Танайд Хоноё аккаунтдаа нэвтэрч <Link href="/mn/support" className="text-green-700 underline">Тусламж</Link> хэсгээс хүсэлт илгээнэ үү.</li>
      <li>“Facebook мэдээлэл устгуулах” гэж бичээд, зөвхөн Facebook холболтоо салгах эсвэл аккаунтаа бүхэлд нь устгуулах эсэхээ тодорхой бичнэ үү.</li>
      <li>Нэвтэрч чадахгүй бол бүртгэлтэй имэйлээсээ <a href="mailto:turbat.enkhbaatar@gmail.com" className="text-green-700 underline">turbat.enkhbaatar@gmail.com</a> хаяг руу хүсэлт илгээнэ үү. Нууц үг, баталгаажуулах кодоо илгээх шаардлагагүй.</li>
    </ol>
    <p>Тусламжийн баг аккаунтын эзэмшлийг шалгаж хүсэлтийг шийдвэрлэнэ. Зөвхөн Facebook холболтыг салгах нь захиалгуудыг устгахгүй. Facebook-ээр л нэвтэрдэг бол салгахаас өмнө бүртгэлтэй имэйлээрээ нууц үг тохируулж авна уу.</p>
    <p>Facebook-ийн Apps and Websites тохиргооноос Танайд Хоноё-д өгсөн зөвшөөрлийг мөн цуцалж болно. Энэ нь Танайд Хоноё аккаунтыг автоматаар устгахгүй.</p>
    <Link href="/mn/privacy" className="block text-green-700 underline">Нууцлалын бодлого</Link>
  </main>;
}
