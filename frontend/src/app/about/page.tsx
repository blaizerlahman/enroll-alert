
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="pt-24 px-6 space-y-12 max-w-3xl mx-auto">
      <section className="flex flex-col items-center space-y-4">
        <h1 className="text-4xl font-bold">About</h1>
        <p>
          EnrollAlert helps UW-Madison students track real-time enrollment
          status for their courses and get notified when seats open up. All it
          takes is an email and a click! Course section information is updated
          when UW Course Search & Enroll is, so you will receive notifications
          as soon as seats open up.
        </p>

        <hr className="border-t border-gray-200 my-12 w-full" />

        <h1 className="text-3xl font-bold">Feedback</h1>
        <p>
          Feedback is welcome! This website is a work in progress and is built by one
          CS student, so it is by no means perfect and improvements can always be made.
          If you have any feedback or notes, from anything to new features or how the site
          looks, please feel free to fill out a feedback form.
        </p>
        <Button>Feedback</Button>

        <hr className="border-t border-gray-200 my-12 w-full" />

        <h1 className="text-3xl font-bold">Support</h1>
        <p>
          If you feel like this site has helped you and you would like to contribute to
          it continuing to help others, your donation would be greatly appreciated. Any 
          money the site receives will go towards future hosting costs to keep it running.
        </p>
        <Button>Donate</Button>
      </section>

      <footer className="mt-16 border-t pt-6 flex flex-row justify-center items-center space-x-4 pb-12">
        <Image
          src="/enrollalert_logo.png"
          alt="EnrollAlert logo"
          width={40}
          height={40}
        />
        <p className="text-sm">
          Created by{" "}
          <Link
            href="https://www.linkedin.com/in/blaizelahman"
            className="underline"
            target="_blank"
          >
            Blaize Lahman
          </Link>
        </p>
        <Link href="https://github.com/blaizerlahman" target="_blank">
          <Github className="size-6" />
        </Link>
      </footer>
    </div>
  )
}

