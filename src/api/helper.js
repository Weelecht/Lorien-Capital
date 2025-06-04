export const getProjects = async() => {
    // Try different path approaches
    const queryString = process.env.NODE_ENV === 'development' 
        ? `${window.location.origin}/data/projects.json`
        : "/data/projects.json";
    
    console.log('Fetching from:', queryString); // Debug log
    
    const res = await fetch(queryString, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })

    console.log('Response status:', res.status); // Debug log

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log('Fetched data:', data); // Debug log
    return data;
}