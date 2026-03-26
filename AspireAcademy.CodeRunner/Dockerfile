FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/sdk:10.0-preview
WORKDIR /app
COPY --from=build /app .

# Install Aspire CLI (standalone installer, not dotnet tool)
RUN curl -fsSL https://aka.ms/install-aspire.sh | bash
ENV PATH="$PATH:/root/.aspire/bin"

# Install Node.js for TypeScript support
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g typescript ts-node

RUN useradd -m coderunner
# Install aspire CLI for coderunner user too
USER coderunner
RUN curl -fsSL https://aka.ms/install-aspire.sh | bash
ENV PATH="$PATH:/home/coderunner/.aspire/bin"
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "AspireAcademy.CodeRunner.dll"]
