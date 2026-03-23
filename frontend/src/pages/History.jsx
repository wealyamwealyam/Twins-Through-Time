import Record from "../components/Record";
import HistoryHeader from "../components/HistoryHeader";

export default function History() {
  return (

    <div className="mx-auto max-w-3xl p-6">

      <HistoryHeader
        onUpload={() => console.log("Upload")}
        onSearchChange={(value) => console.log(value)}
      />

  
      <Record
        imageSrc="/Twins-Through-Time/DemoPictures/Grenville-M.-Dodge.jpg"
        title="Grenville M. Dodge"
        subtitle="Lieutenant"
        date="1863"
        location="Virginia"
        traits={[
          { label: "Uniform", value: "Union" },
          { label: "Medium", value: "Tintype" },
          "Beard",
          "Studio backdrop",
        ]}
        onClick={() => console.log("Open details")}
      />
      <br/>
      <Record
        imageSrc="/Twins-Through-Time/DemoPictures/oldguy.jpg"
        title="Richard G. Davis"
        subtitle="Sergeant"
        date="1867"
        location="South Carolina"
        traits={[
          { label: "Uniform", value: "Confederate" },
          { label: "Medium", value: "Tintype" },
          "Beard",
          "Close Up",
        ]}
        onClick={() => console.log("Open details")}
      />
      <br/>
      <Record
        imageSrc="/Twins-Through-Time/DemoPictures/youngkid.jpg"
        title="Steve L. Junior"
        subtitle="Colonel"
        date="1870"
        location="Virginia"
        traits={[
          { label: "Uniform", value: "Union" },
          { label: "Medium", value: "Tintype" },
          "No Facial Hair",
          "Studio backdrop",
        ]}
        onClick={() => console.log("Open details")}
      />
    </div>
  );
}